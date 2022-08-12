import type { AbsolutePath } from '../../paths'

import { pathToFileURL } from 'node:url'

import { parse } from '@babel/parser'
import {
  Comment, isDeclaration,
  isExportDeclaration,
  isFile,
  isIfStatement,
  isImportDeclaration,
  isProgram, isTryStatement,
  isTSDeclareMethod,
  isTSTypeReference,
  isTypeScript,
  Node,
  VISITOR_KEYS
} from '@babel/types'

import { $p, Logger } from '../../log'
import { readFile } from '../../utils/asyncfs'
import { CoverageAnalyser } from './analysis'

/* ========================================================================== *
 * EXPORTED CONSTANTS AND TYPES                                               *
 * ========================================================================== */

/**
 * A constant indicating that coverage was skipped (is irrelevant, for e.g.
 * comment or typescript definition nodes)
 */
export const COVERAGE_SKIPPED = -2

/**
 * A constant indicating that coverage was intentionally ignored because of a
 * specific "coverage ignore ..." comment
 */
export const COVERAGE_IGNORED = -1

/** Node coverage summary */
export interface NodeCoverageResult {
  /** Number of _covered_ nodes (good!) */
  coveredNodes: number,
  /** Number of nodes with _no coverage_ (bad!) */
  missingNodes: number,
  /** Number of nodes ignored by comments like `coverage ignore xxx` */
  ignoredNodes: number,
  /** Total number of nodes (sum of `covered`, `missing` and `ignored`) */
  totalNodes: number,
  /** Percentage of code coverage (covered as a % of total - ignored nodes)*/
  coverage: number,
}

/** Per-file coverage result */
export interface CoverageResult {
  /** The actual code this coverage is for */
  code: string,
  /**
   * Per _character_ coverage report:
   * - `-2`: coverage skipped (comments, typescript declarations, ...)
   * - `-1`: coverage ignored (when using `coverage ignore xxx`)
   * - `0`: no coverage collected for this character
   * - _any number greater than zero_: number of times this was covered
   */
  codeCoverage: number[],
  /** Node coverage summary */
  nodeCoverage: NodeCoverageResult,
}

/** Aggregation of {@link CoverageResult} over all files */
export type CoverageResults = Record<AbsolutePath, CoverageResult>

/** Our coverage report, per file */
export interface CoverageReport {
  results: CoverageResults,
  nodes: NodeCoverageResult,
}

/* ========================================================================== *
 * EXPORTED CONSTANTS AND TYPES                                               *
 * ========================================================================== */

/** Tokens for `coverage ignore xxx`, this should be self-explanatory */
type IgnoreCoverage = 'test' | 'if' | 'else' | 'try' | 'catch' | 'finally' | 'next'

/** Regular expression matching strings like `coverage ignore xxx` */
const ignoreRegexp = /(coverage|istanbul)\s+ignore\s+(test|if|else|try|catch|finally|next)(\s|$)/g

/* ========================================================================== *
 * EXPORTED CONSTANTS AND TYPES                                               *
 * ========================================================================== */

/**
 * Analyse coverage for the specified source files, using the data from the
 * specified coverage files and produce a {@link CoverageReport}.
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
    * Here comes the interesting part: we need to parse the original soruces,
    * walk their ASTs and see whether each node has been covered or not.
    * We look up every node's position, (for sitemaps, map this to the position
    * in the resulting file) then look at the coverage.
    */
  for (const file of sourceFiles) {
    /* Read up the file and parse the tree in the most liberal way possible */
    const url = pathToFileURL(file).toString()
    const code = await readFile(file, 'utf-8')

    const tree = parse(code, {
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
      plugins: [ 'typescript' ],
      strictMode: false,
      ranges: false,
      tokens: false,
      createParenthesizedExpressions: true,
    })

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

      const keys = VISITOR_KEYS[node.type] || []
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
      const keys = VISITOR_KEYS[node.type] || []
      for (const key of keys) {
        const children: Node | Node[] = (<any> node)[key]
        if (Array.isArray(children)) {
          for (const child of children) {
            visitNode(child, depth + 1)
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
      /* See what we're doing here... */
      log.trace('-'.padStart((depth * 2) + 1, ' '), node.type, `${node.loc?.start.line}:${node.loc?.start.column}`)

      /* Root nodes (file and program) simply go to their children */
      if (isFile(node)) return visitChildren(node, depth)
      if (isProgram(node)) return visitChildren(node, depth)

      /* Figure out if we have some "coverage ignore xxxx" in comments */
      const ignores: IgnoreCoverage[] = []
      for (const comment of node.leadingComments || []) {
        for (const match of comment.value.matchAll(ignoreRegexp)) {
          ignores.push(match[2] as IgnoreCoverage)
        }
      }

      /* Skip this node if we have a "coverage ignore next" comment */
      if (ignores.includes('next')) return setCodeCoverage(node, COVERAGE_IGNORED, true)

      /* Typescript nodes are skipped, but children aren't in some cases */
      if (isTypeScript(node)) {
        if (isTSDeclareMethod(node)) return setCodeCoverage(node, COVERAGE_SKIPPED, true)
        if (isTSTypeReference(node)) return setCodeCoverage(node, COVERAGE_SKIPPED, true)
        if (isDeclaration(node)) return setCodeCoverage(node, COVERAGE_SKIPPED, true)

        /* For things like "X as Y": the "as" node wraps the expression */
        setCodeCoverage(node, COVERAGE_SKIPPED, false) // not recursive
        return visitChildren(node, depth) // visit all children normally...
      }

      // Typescript "import type" or "export type" get skipped all together
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
        if (c == null) log.warn(`No coverage for ${node.type} at ${$p(file)}:${line}:${column}`)
        else coverage = c
      }

      /* Record the code coverage, and set up our variables */
      setCodeCoverage(node, coverage, false)

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

      /* All other nodes simply gets visited recursively*/
      visitChildren(node, depth)
    }

    /* Start by setting the scope of our coverage in the code */
    codeCoverage.fill(COVERAGE_SKIPPED) // by default, everything is skipped
    setCodeCoverage(tree.program.directives, 0, true) // directives must be covered
    setCodeCoverage(tree.program.body, 0, true) // program body must be covered

    /* Cleanup our node statistics */
    nodeCoverage.coveredNodes = 0
    nodeCoverage.missingNodes = 0
    nodeCoverage.ignoredNodes = 0

    /* Visit all of the program nodes */
    visitChildren(tree.program, -1)

    /*
      * As comments are mixed within codes (and do not get visited in the
      * tree) we force-skip them _AFTER_ the tree is visited, otherwise (for
      * example) a comment within a block will be shown with the coverage of
      * the block itself.
      */
    // setCodeCoverage(tree.comments, COVERAGE_SKIPPED, true)

    /* Update nodes coverage results */
    updateNodeCoverageResult(nodeCoverage)

    nodes.coveredNodes += nodeCoverage.coveredNodes
    nodes.missingNodes += nodeCoverage.missingNodes
    nodes.ignoredNodes += nodeCoverage.ignoredNodes
    nodes.totalNodes += nodeCoverage.totalNodes

    /* This file is done, add it to the report */
    results[file] = { code, codeCoverage, nodeCoverage }
  }

  /* All done, return the report */
  updateNodeCoverageResult(nodes)
  return { results, nodes }
}

function updateNodeCoverageResult(result: NodeCoverageResult): void {
  const { coveredNodes, missingNodes, ignoredNodes } = result
  const totalNodes = result.totalNodes = coveredNodes + missingNodes + ignoredNodes
  if (totalNodes - ignoredNodes) {
    result.coverage = Math.floor((100 * coveredNodes) / (totalNodes - ignoredNodes))
  } else {
    result.coverage = 0 // No "infinity" on division by zero...
  }
}
