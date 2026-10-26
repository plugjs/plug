import { pathToFileURL } from 'node:url'

import { parse } from '@babel/parser'
import {
  isDeclaration,
  isExportDeclaration,
  isExportNamedDeclaration,
  isFile,
  isIfStatement,
  isImportDeclaration,
  isProgram,
  isTryStatement,
  isTSDeclareMethod,
  isTSEnumDeclaration,
  isTSEnumMember,
  isTSModuleDeclaration,
  isTSTypeReference,
  isTypeScript,
  VISITOR_KEYS,
} from '@babel/types'
import { readFile } from '@plugjs/plug/fs'
import { $p } from '@plugjs/plug/logging'

import type { ParseResult } from '@babel/parser'
import type { Comment, File, Node } from '@babel/types'
import type { Logger } from '@plugjs/plug/logging'
import type { AbsolutePath } from '@plugjs/plug/paths'
import type { CoverageAnalyser } from './analysis.ts'

/* ========================================================================== *
 * EXPORTED CONSTANTS AND TYPES                                               *
 * ========================================================================== */

/**
 * Coverage is not applicable, for example to comments or erased TypeScript
 * syntax. Skipped nodes do not contribute to coverage totals.
 */
export const COVERAGE_SKIPPED = -2

/**
 * Coverage was explicitly ignored by a `coverage ignore ...` or
 * `istanbul ignore ...` comment.
 */
export const COVERAGE_IGNORED = -1

/** Node coverage summary. */
export interface NodeCoverageResult {
  /** Number of nodes with a positive execution count. */
  coveredNodes: number,
  /** Number of nodes with a zero execution count. */
  missingNodes: number,
  /** Number of nodes ignored by comments like `coverage ignore xxx`. */
  ignoredNodes: number,
  /** Sum of coveredNodes, missingNodes, and ignoredNodes; excludes skipped nodes. */
  totalNodes: number,
  /**
   * Node coverage percentage, rounded down: 100 * coveredNodes /
   * (coveredNodes + missingNodes).
   *
   * Null when no nodes remain after excluding ignored and skipped nodes,
   * including empty files, ignored files, and files containing only types.
   */
  coverage: number | null,
}

/** Per-file coverage result. */
export interface CoverageResult {
  /** The original source text. */
  code: string,
  /**
   * Coverage for each UTF-16 code unit in the source, derived from AST node spans:
   * - `-2`: coverage skipped (comments, erased TypeScript syntax, etc.)
   * - `-1`: coverage ignored (when using `coverage ignore xxx`)
   * - `0`: uncovered code
   * - positive values: execution counts assigned from the corresponding AST nodes
   */
  codeCoverage: number[],
  /** Unique one-based line numbers containing any uncovered code, in ascending order. */
  uncoveredLines: number[],
  /** Node coverage summary. */
  nodeCoverage: NodeCoverageResult,
}

/** Aggregation of {@link CoverageResult} over all files. */
export type CoverageResults = Record<AbsolutePath, CoverageResult>

/** Per-file results and the aggregate node coverage summary. */
export interface CoverageReport {
  results: CoverageResults,
  nodes: NodeCoverageResult,
}

/* ========================================================================== *
 * IGNORE DIRECTIVES                                                          *
 * ========================================================================== */

/** Supported targets for coverage-ignore comments. */
type IgnoreCoverage = 'test' | 'if' | 'else' | 'try' | 'catch' | 'finally' | 'next' | 'prev' | 'file'

/** Match a leading `coverage ignore` or `istanbul ignore` directive in a comment. */
const ignoreRegexp = /^\s+(coverage|istanbul)\s+ignore\s+(test|if|else|try|catch|finally|next|prev|file)(\s|$)/g

/* ========================================================================== *
 * REPORT GENERATION                                                          *
 * ========================================================================== */

/**
 * Analyse the original source files with the supplied coverage analyser and
 * return character-level coverage and AST node summaries.
 */
export async function coverageReport(
    analyser: CoverageAnalyser,
    sourceFiles: AbsolutePath[],
    log: Logger,
): Promise<CoverageReport> {
  /* Some of our results */
  const results: CoverageResults = {}
  const nodes: NodeCoverageResult = {
    coveredNodes: 0,
    missingNodes: 0,
    ignoredNodes: 0,
    totalNodes: 0,
    coverage: 0,
  }

  /*
   * Parse each original source and query coverage at each counted node's start.
   * The analyser handles any mapping from original to generated positions.
   */
  for (const file of sourceFiles) {
    /* Read the source and parse it with permissive JavaScript and TypeScript options */
    const url = pathToFileURL(file).toString()
    const code = await readFile(file, 'utf-8')

    let tree: ParseResult<File>
    /* coverage ignore catch */
    try {
      tree = parse(code, {
        allowImportExportEverywhere: true,
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
        allowSuperOutsideMethod: true,
        allowUndeclaredExports: true,
        attachComment: true,
        errorRecovery: false,
        sourceType: 'unambiguous',
        sourceFilename: file,
        startLine: 1,
        startColumn: 0,
        plugins: [ 'typescript', 'decorators' ],
        strictMode: false,
        ranges: false,
        tokens: false,
        createParenthesizedExpressions: true,
      })
    } catch (error) {
      log.fail(`Error parsing ${$p(file)}`, error)
    }

    const codeCoverage: number[] = new Array(code.length).fill(0)
    const nodeCoverage: NodeCoverageResult = {
      coveredNodes: 0,
      missingNodes: 0,
      ignoredNodes: 0,
      totalNodes: 0,
      coverage: 0,
    }

    /* Set the code coverage for the specified node and (optionally) its children */
    const setCodeCoverage = (
        node: (Node | Comment)[] | Node | Comment | undefined | null,
        coverage: number,
        recursive: boolean,
    ): void => {
      if (! node) return

      if (Array.isArray(node)) {
        for (const n of node) setCodeCoverage(n, coverage, recursive)
        return
      }

      if ((node.start != null) && (node.end != null)) {
        for (let i = node.start; i < node.end; i ++) {
          codeCoverage[i] = coverage
        }
      }

      if (coverage == COVERAGE_IGNORED) {
        nodeCoverage.ignoredNodes++
      } else if (coverage === 0) {
        nodeCoverage.missingNodes++
      } else if (coverage > 0) {
        nodeCoverage.coveredNodes++
      }

      if (! recursive) return

      const keys = VISITOR_KEYS[node.type] || /* coverage ignore next */ []
      for (const key of keys) {
        const value: Node | Node[] = (<any> node)[key]
        if (Array.isArray(value)) {
          for (const child of value) {
            setCodeCoverage(child, coverage, true)
          }
        } else if (value) {
          setCodeCoverage(value, coverage, true)
        }
      }
    }

    /* Recursively invoke "visitNode" on the children of a given node */
    const visitChildren = (node: Node, depth: number): void => {
      const keys = VISITOR_KEYS[node.type] || /* coverage ignore next */ []
      for (const key of keys) {
        const children: Node | null | (Node | null)[] = (<any> node)[key]
        if (Array.isArray(children)) {
          for (const child of children) {
            if (child) visitNode(child, depth + 1)
          }
        } else if (children) {
          visitNode(children, depth + 1)
        }
      }
    }

    /* Visit a node or ignore it depending on a condition */
    const maybeIgnoreNode = (
        condition: boolean,
        node: Node | null | undefined,
        depth: number,
    ): void => {
      if (condition) {
        setCodeCoverage(node, COVERAGE_IGNORED, true)
      } else if (node) {
        visitNode(node, depth)
      }
    }

    /* Visit a node and evaluate its coverage */
    const visitNode = (node: Node, depth: number): void => {
      /* Trace the node type and source position */
      log.trace('-'.padStart((depth * 2) + 1, ' '), node.type, `${node.loc?.start.line}:${node.loc?.start.column}`)

      /* Root nodes (file and program) simply go to their children */
      // coverage ignore if / traversal starts with the children of tree.program
      if (isFile(node)) return visitChildren(node, depth)
      // coverage ignore if / traversal starts with the children of tree.program
      if (isProgram(node)) return visitChildren(node, depth)

      /* Read ignore directives from comments attached to this node */
      const ignores: IgnoreCoverage[] = []
      for (const comment of node.leadingComments || []) {
        for (const match of comment.value.matchAll(ignoreRegexp)) {
          if (match[2] !== 'prev') ignores.push(match[2] as IgnoreCoverage)
        }
      }
      for (const comment of node.trailingComments || []) {
        for (const match of comment.value.matchAll(ignoreRegexp)) {
          if (match[2] === 'prev') ignores.push(match[2] as IgnoreCoverage)
        }
      }

      /* Ignore this subtree when a next or prev directive applies */
      if (ignores.includes('next')) return setCodeCoverage(node, COVERAGE_IGNORED, true)
      if (ignores.includes('prev')) return setCodeCoverage(node, COVERAGE_IGNORED, true)

      /* An enum's export wrapper must not count when the enum itself is erased */
      if (isExportNamedDeclaration(node) && isTSEnumDeclaration(node.declaration)) {
        setCodeCoverage(node, COVERAGE_SKIPPED, false)
        return visitNode(node.declaration, depth + 1)
      }

      /* Namespace syntax is skipped, but non-ambient bodies execute */
      if (isTSModuleDeclaration(node)) {
        setCodeCoverage(node, COVERAGE_SKIPPED, true)
        if (node.declare || node.kind === 'global' || node.id.type === 'StringLiteral') return
        return visitNode(node.body, depth + 1)
      }

      /* Enum members execute; the declaration wrapper and name do not */
      if (isTSEnumDeclaration(node)) {
        setCodeCoverage(node, COVERAGE_SKIPPED, true)
        if (node.declare) return
        /* Const enums can be erased: only count them when members have generated code */
        if (node.const && ! node.body.members.some((member) => {
          const start = member.loc?.start
          return start && analyser.hasMapping(url, start.line, start.column)
        })) return
        for (const member of node.body.members) visitNode(member, depth + 1)
        return
      }

      /* Skip TypeScript syntax while visiting runtime children where applicable */
      if (isTypeScript(node) && ! isTSEnumMember(node)) {
        /* Method and constructor overload signatures */
        if (isTSDeclareMethod(node)) return setCodeCoverage(node, COVERAGE_SKIPPED, true)

        /* Type references and their type arguments */
        if (isTSTypeReference(node)) return setCodeCoverage(node, COVERAGE_SKIPPED, true)

        /* Skip remaining TypeScript declarations */
        if (isDeclaration(node)) return setCodeCoverage(node, COVERAGE_SKIPPED, true)

        /* For things like "X as Y": the "as" node wraps the expression */
        setCodeCoverage(node, COVERAGE_SKIPPED, false) // not recursive
        return visitChildren(node, depth) // visit all children normally...
      }

      // Skip declarations marked as "import type" or "export type".
      if (isExportDeclaration(node) && (node.exportKind === 'type')) {
        return setCodeCoverage(node, COVERAGE_SKIPPED, true)
      }

      if (isImportDeclaration(node) && (node.importKind === 'type')) {
        return setCodeCoverage(node, COVERAGE_SKIPPED, true)
      }

      /* Ok, from here we calculate the coverage */
      let coverage = 0
      if (node.loc) {
        const { line, column } = node.loc.start
        const c = analyser.coverage(url, line, column)
        // coverage ignore if / broken V8 coverage???
        if (c == null) {
          log.warn(`No coverage for ${node.type} at ${$p(file)}:${line}:${column}`)
        } else {
          coverage = c
        }
      }

      /* Record the code coverage, and set up our variables */
      setCodeCoverage(node, coverage, false)

      /* Count each enum member once, then analyse any initializer expression */
      if (isTSEnumMember(node)) {
        if (node.initializer) visitNode(node.initializer, depth + 1)
        return
      }

      /* The "if" node might have some ignores... */
      if (isIfStatement(node)) {
        maybeIgnoreNode(ignores.includes('test'), node.test, depth + 1)
        maybeIgnoreNode(ignores.includes('if'), node.consequent, depth + 1)
        maybeIgnoreNode(ignores.includes('else'), node.alternate, depth + 1)
        return
      }

      /* The "try" node might have some ignores... */
      if (isTryStatement(node)) {
        maybeIgnoreNode(ignores.includes('try'), node.block, depth + 1)
        maybeIgnoreNode(ignores.includes('catch'), node.handler, depth + 1)
        maybeIgnoreNode(ignores.includes('finally'), node.finalizer, depth + 1)
        return
      }

      /* Visit the children of all other nodes recursively*/
      visitChildren(node, depth)
    }

    /* Start by setting the scope of our coverage in the code */
    codeCoverage.fill(COVERAGE_SKIPPED) // by default, everything is skipped
    setCodeCoverage(tree.program.directives, 0, true) // directives must be covered
    setCodeCoverage(tree.program.body, 0, true) // program body must be covered

    /* Reset the counters accumulated while initializing character coverage. */
    nodeCoverage.coveredNodes = 0
    nodeCoverage.missingNodes = 0
    nodeCoverage.ignoredNodes = 0

    /* Check leading comments on the first directive or body statement for a file ignore. */
    let ignoreFileCoverage = false
    const firstNode = tree.program.directives[0] ?? tree.program.body[0]
    for (const comment of firstNode?.leadingComments || []) {
      for (const match of comment.value.matchAll(ignoreRegexp)) {
        if (match[2] === 'file') {
          ignoreFileCoverage = true
          break
        }
      }
      /* Already matched "coverage ignore file", skip the rest */
      if (ignoreFileCoverage) break
    }

    /* If we found a "coverage ignore file" at the beginning, ignore the file */
    if (ignoreFileCoverage) {
      setCodeCoverage(tree.program, COVERAGE_IGNORED, true)
    } else {
      visitChildren(tree.program, -1)
    }

    /*
     * Comments are not visited through VISITOR_KEYS. Mark them as skipped after
     * traversing the AST so they do not retain coverage from enclosing nodes.
     */
    setCodeCoverage(tree.comments, COVERAGE_SKIPPED, false)

    /* Collect uncovered lines after children and comments have finalized coverage */
    const uncoveredLinesSet = new Set<number>()
    let line = 1
    for (let i = 0; i < code.length; i++) {
      if (code[i] === '\n') {
        line++
      } else if (code[i] !== '\r' && codeCoverage[i] === 0) {
        uncoveredLinesSet.add(line)
      }
    }
    const uncoveredLines = [ ...uncoveredLinesSet ]

    /* Update nodes coverage results */
    updateNodeCoverageResult(nodeCoverage)

    nodes.coveredNodes += nodeCoverage.coveredNodes
    nodes.missingNodes += nodeCoverage.missingNodes
    nodes.ignoredNodes += nodeCoverage.ignoredNodes
    nodes.totalNodes += nodeCoverage.totalNodes

    /* This file is done, add it to the report */
    results[file] = { code, codeCoverage, uncoveredLines, nodeCoverage }
  }

  /* All done, return the report */
  updateNodeCoverageResult(nodes)
  return { results, nodes }
}

function updateNodeCoverageResult(result: NodeCoverageResult): void {
  const { coveredNodes, missingNodes, ignoredNodes } = result
  const totalNodes = result.totalNodes = coveredNodes + missingNodes + ignoredNodes
  if (totalNodes === 0) {
    result.coverage = null // No counted nodes: the source is empty or entirely skipped.
  } else if (totalNodes === ignoredNodes) {
    result.coverage = null // All nodes were ignored (e.g. coverage ignore file)
  } else {
    result.coverage = Math.floor((100 * coveredNodes) / (totalNodes - ignoredNodes))
  }
}
