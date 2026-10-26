import { mkdir, realpath, symlink, unlink, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import { BuildFailure, exec, find, merge, mkdtemp, rmrf } from '@plugjs/plug'
import { getLogger } from '@plugjs/plug/logging'
import { resolveAbsolutePath } from '@plugjs/plug/paths'
import { createProgram, ModuleKind, ScriptTarget, transpileModule } from 'typescript'

import { createAnalyser } from '../src/analysis.ts'
import { Coverage } from '../src/coverage.ts'
import { COVERAGE_SKIPPED, coverageReport } from '../src/report.ts'

import type { AbsolutePath, Files } from '@plugjs/plug'
import type { CoverageAnalyser } from '../src/analysis.ts'
import type { CoverageResult } from '../src/report.ts'

describe('Runtime TypeScript declarations', () => {
  async function analyse(code: string, options: {
    preserveConstEnums?: boolean,
    symlinkSource?: boolean,
  } = {}): Promise<CoverageResult> {
    const directory = await realpath(mkdtemp()) as AbsolutePath
    let analyser: CoverageAnalyser | undefined
    try {
      const file = resolveAbsolutePath(directory, 'source.ts')
      const script = resolveAbsolutePath(directory, 'source.cjs')
      const coverageDir = resolveAbsolutePath(directory, 'coverage')
      await writeFile(file, code)
      const compilerOptions = {
        module: ModuleKind.CommonJS,
        target: ScriptTarget.ES2022,
        inlineSourceMap: true,
        inlineSources: true,
      }
      let outputText: string
      if (options.preserveConstEnums === undefined) {
        outputText = transpileModule(code, { fileName: file, compilerOptions }).outputText
      } else {
        outputText = ''
        createProgram([ file ], {
          ...compilerOptions,
          preserveConstEnums: options.preserveConstEnums,
        }).emit(undefined, (name, contents) => {
          if (name.endsWith('.js')) outputText = contents
        })
      }
      await writeFile(script, outputText)
      await exec(process.execPath, script, { coverageDir })
      const coverageFiles = await find('coverage-*.json', { directory: coverageDir })
      const selected = options.symlinkSource ? resolveAbsolutePath(directory, 'linked.ts') : file
      if (options.symlinkSource) await symlink(file, selected)
      const sources = [ ...new Set([ file, selected ]) ]
      analyser = await createAnalyser(sources, [ ...coverageFiles.absolutePaths() ], 'least_upper_bound', getLogger())
      const report = await coverageReport(analyser, sources, getLogger())
      expect(report.results[selected]).toEqual(report.results[file])
      return report.results[selected]!
    } finally {
      analyser?.destroy()
      await rmrf(directory)
    }
  }

  it('should distinguish called and uncalled namespace functions', async () => {
    const code = [
      'namespace Example {',
      '  export function missed() {',
      '    return 1',
      '  }',
      '  export function called() {',
      '    return 2',
      '  }',
      '}',
      'Example.called()',
    ].join('\n')
    const result = await analyse(code)
    expect(result.uncoveredLines.includes(3)).toEqual(true)
    expect(result.uncoveredLines.includes(6)).toEqual(false)
    expect(result.nodeCoverage.missingNodes).toBeGreaterThan(0)
    expect(result.nodeCoverage.coveredNodes).toBeGreaterThan(0)
    expect(result.codeCoverage[code.indexOf('Example')]).toEqual(COVERAGE_SKIPPED)
  })

  it('should traverse nested and dotted namespaces', async () => {
    const result = await analyse([
      'namespace Outer.Inner {',
      '  export namespace Nested {',
      '    export function missed() {',
      '      return 1',
      '    }',
      '    export const value = 2',
      '  }',
      '}',
    ].join('\n'))
    expect(result.uncoveredLines.includes(4)).toEqual(true)
    expect(result.uncoveredLines.includes(6)).toEqual(false)
  })

  it('should cover executed enum members and initializers', async () => {
    const code = 'enum Example {\n  Auto,\n  Explicit = Math.abs(-2),\n  Text = "text",\n}\n'
    const result = await analyse(code)
    expect(result.nodeCoverage.coveredNodes).toBeGreaterThan(0)
    expect(result.nodeCoverage.coverage).toEqual(100)
    expect(result.uncoveredLines).toEqual([])
    expect(result.codeCoverage[code.indexOf('Example')]).toEqual(COVERAGE_SKIPPED)
  })

  it('should report enum members inside an uncalled function as uncovered', async () => {
    const result = await analyse([
      'function missed() {',
      '  enum Example {',
      '    Auto,',
      '    Explicit = Math.abs(-2),',
      '    Text = "text",',
      '  }',
      '}',
    ].join('\n'))
    expect(result.uncoveredLines.includes(3)).toEqual(true)
    expect(result.uncoveredLines.includes(4)).toEqual(true)
    expect(result.uncoveredLines.includes(5)).toEqual(true)
  })

  it('should keep ambient namespaces, modules, and enums skipped', async () => {
    const result = await analyse([
      'declare namespace Example {',
      '  function missed(): number',
      '  enum Nested { First, Second }',
      '}',
      'declare module "external" { export function missed(): number }',
      'declare enum Other { First, Second }',
      'interface Shape { value: number }',
      'type Name = string',
    ].join('\n'))
    expect(result.nodeCoverage.totalNodes).toEqual(0)
    expect(result.nodeCoverage.coverage).toEqual(null)
    expect(result.uncoveredLines).toEqual([])
  })

  it('should skip const enums erased by the compiler', async () => {
    for (const prefix of [ '', 'export ' ]) {
      const result = await analyse(`${prefix}const enum Example { A, B }`, { preserveConstEnums: false })
      expect(result.nodeCoverage.totalNodes).toEqual(0)
      expect(result.nodeCoverage.coverage).toEqual(null)
      expect(result.uncoveredLines).toEqual([])
    }
  })

  it('should not borrow mappings from code after an erased const enum', async () => {
    const result = await analyse([
      'const enum Example {',
      '  A,',
      '  B,',
      '}',
      'function missed() { return 1 }',
    ].join('\n'), { preserveConstEnums: false })
    expect(result.uncoveredLines).toEqual([ 5 ])
  })

  it('should cover const enums preserved by the compiler or transpiler', async () => {
    for (const options of [ {}, { preserveConstEnums: true } ]) {
      const result = await analyse('export const enum Example { A, B }', options)
      expect(result.nodeCoverage.coveredNodes).toEqual(2)
      expect(result.nodeCoverage.coverage).toEqual(100)
      expect(result.uncoveredLines).toEqual([])
    }
  })

  it('should report preserved const enums as uncovered when they do not execute', async () => {
    const result = await analyse([
      'function missed() {',
      '  const enum Example {',
      '    A,',
      '    B,',
      '  }',
      '}',
    ].join('\n'), { preserveConstEnums: true })
    expect(result.uncoveredLines.includes(3)).toEqual(true)
    expect(result.uncoveredLines.includes(4)).toEqual(true)
  })

  it('should resolve source-map coverage through symlink aliases without duplicating counts', async () => {
    const result = await analyse('const enum Example { A, B }', { symlinkSource: true })
    expect(result.nodeCoverage.coverage).toEqual(100)
    expect(result.uncoveredLines).toEqual([])
    expect(Math.max(...result.codeCoverage)).toEqual(1)
  })
})

describe('Coverage file matching', () => {
  it('should distinguish unexecuted direct code from a source that was never loaded', async () => {
    const directory = await realpath(mkdtemp()) as AbsolutePath
    let analyser: CoverageAnalyser | undefined
    try {
      const loaded = resolveAbsolutePath(directory, 'loaded.cjs')
      const unloaded = resolveAbsolutePath(directory, 'unloaded.cjs')
      const coverageDir = resolveAbsolutePath(directory, 'coverage')
      await writeFile(loaded, 'Math.abs(-1);\nfunction missed() { return 1 }\n')
      await writeFile(unloaded, 'Math.abs(-2);\n')
      await exec(process.execPath, loaded, { coverageDir })
      const coverageFiles = await find('coverage-*.json', { directory: coverageDir })
      analyser = await createAnalyser([ loaded, unloaded ], [ ...coverageFiles.absolutePaths() ], 'none', getLogger())
      const loadedUrl = pathToFileURL(loaded).toString()
      const unloadedUrl = pathToFileURL(unloaded).toString()

      expect(analyser.hasMapping(loadedUrl, 1, 0)).toEqual(true)
      expect(analyser.coverage(loadedUrl, 1, 0)).toEqual(1)
      expect(analyser.hasMapping(loadedUrl, 2, 0)).toEqual(true)
      expect(analyser.coverage(loadedUrl, 2, 0)).toEqual(0)
      expect(analyser.hasMapping(unloadedUrl, 1, 0)).toEqual(false)
      expect(analyser.coverage(unloadedUrl, 1, 0)).toEqual(0)
    } finally {
      analyser?.destroy()
      await rmrf(directory)
    }
  })

  it('should retain requested coverage when an unrelated recorded script has been deleted', async () => {
    const directory = await realpath(mkdtemp()) as AbsolutePath
    let analyser: CoverageAnalyser | undefined
    try {
      const file = resolveAbsolutePath(directory, 'source.cjs')
      const temporary = resolveAbsolutePath(directory, 'temporary.cjs')
      const coverageDir = resolveAbsolutePath(directory, 'coverage')
      await writeFile(file, 'require("./temporary.cjs");\nMath.abs(-1);\n')
      await writeFile(temporary, 'Math.abs(-2);\n')
      await exec(process.execPath, file, { coverageDir })
      await unlink(temporary)
      const coverageFiles = await find('coverage-*.json', { directory: coverageDir })
      analyser = await createAnalyser([ file ], [ ...coverageFiles.absolutePaths() ], 'none', getLogger())
      const report = await coverageReport(analyser, [ file ], getLogger())
      expect(report.results[file]!.nodeCoverage.coverage).toEqual(100)
      expect(report.results[file]!.uncoveredLines).toEqual([])
    } finally {
      analyser?.destroy()
      await rmrf(directory)
    }
  })

  async function analyse(code: string, alias?: 'file' | 'directory'): Promise<CoverageResult> {
    const directory = await realpath(mkdtemp()) as AbsolutePath
    let analyser: CoverageAnalyser | undefined
    try {
      const sourceDir = resolveAbsolutePath(directory, 'sources')
      await mkdir(sourceDir)
      const file = resolveAbsolutePath(sourceDir, 'source.cjs')
      await writeFile(file, code)
      let selected = file
      if (alias === 'file') {
        selected = resolveAbsolutePath(directory, 'linked.cjs')
        await symlink(file, selected)
      } else if (alias === 'directory') {
        const linkedDir = resolveAbsolutePath(directory, 'linked')
        await symlink(sourceDir, linkedDir, 'dir')
        selected = resolveAbsolutePath(linkedDir, 'source.cjs')
      }
      const coverageDir = resolveAbsolutePath(directory, 'coverage')
      await exec(process.execPath, selected, { coverageDir })
      const coverageFiles = await find('coverage-*.json', { directory: coverageDir })
      const sources = [ ...new Set([ file, selected ]) ]
      analyser = await createAnalyser(sources, [ ...coverageFiles.absolutePaths() ], 'least_upper_bound', getLogger())
      const report = await coverageReport(analyser, sources, getLogger())
      expect(report.results[selected]).toEqual(report.results[file])
      return report.results[selected]!
    } finally {
      analyser?.destroy()
      await rmrf(directory)
    }
  }

  it('should retain direct coverage when the source map is missing', async () => {
    const result = await analyse('Math.abs(-1);\n//# sourceMappingURL=missing.map\n')
    expect(result.nodeCoverage.coverage).toEqual(100)
    expect(result.uncoveredLines).toEqual([])
  })

  for (const alias of [ 'file', 'directory' ] as const) {
    it(`should match coverage through a symlinked ${alias}`, async () => {
      const result = await analyse('Math.abs(-1);\n', alias)
      expect(result.nodeCoverage.coverage).toEqual(100)
      expect(result.uncoveredLines).toEqual([])
      expect(Math.max(...result.codeCoverage)).toEqual(1)
    })
  }
})

describe('Uncovered lines', () => {
  async function uncoveredLines(code: string, coverage: CoverageAnalyser['coverage']): Promise<number[]> {
    const directory = mkdtemp()
    try {
      const file = resolveAbsolutePath(directory, 'source.ts')
      await writeFile(file, code)
      const report = await coverageReport({ coverage, hasMapping: () => true, destroy() {} }, [ file ], getLogger())
      return report.results[file]!.uncoveredLines
    } finally {
      await rmrf(directory)
    }
  }

  it('should include partially covered lines once and exclude covered lines', async () => {
    const lines = await uncoveredLines('foo();\nfoo(); bar(); baz();\nfoo();\n', (_source, line, column) => {
      return line === 2 && column >= 7 ? 0 : 1
    })
    expect(lines).toEqual([ 2 ])
  })

  it('should exclude skipped types, comments, and ignored code', async () => {
    const code = [
      'type Foo = string',
      '// comment',
      '/* coverage ignore next */',
      'ignored();',
      '/* istanbul ignore next */',
      'alsoIgnored();',
      'missing();',
    ].join('\n')
    expect(await uncoveredLines(code, () => 0)).toEqual([ 7 ])
    expect(await uncoveredLines('/* coverage ignore file */\nfoo();\n', () => 0)).toEqual([])
    expect(await uncoveredLines('', () => 0)).toEqual([])
  })

  it('should honor file-ignore comments before directives', async () => {
    for (const prefix of [ 'coverage', 'istanbul' ]) {
      for (const body of [
        '"use strict";\nfoo();\n',
        '"use strict";\n',
        '"use strict";\n"another directive";\nfoo();\n',
      ]) {
        const code = `/* ${prefix} ignore file */\n${body}`
        const lines = await uncoveredLines(code, () => {
          throw new Error('Ignored files must not query coverage')
        })
        expect(lines).toEqual([])
      }
    }
  })

  it('should measure directives without a file-ignore comment', async () => {
    const code = '"use strict";\nfoo();\n'
    expect(await uncoveredLines(code, () => 0)).toEqual([ 1, 2 ])
    expect(await uncoveredLines(code, () => 1)).toEqual([])
  })

  it('should not treat comments after the first directive as file ignores', async () => {
    const code = '"use strict";\n/* coverage ignore file */\nfoo();\n'
    expect(await uncoveredLines(code, () => 0)).toEqual([ 1, 3 ])
  })

  it('should handle CRLF, blank lines, and a trailing newline', async () => {
    const code = 'foo(); bar();\r\n\r\n// comment\r\nbaz();\r\n'
    expect(await uncoveredLines(code, () => 0)).toEqual([ 1, 4 ])
  })

  it('should preserve numeric order across single and double digit lines', async () => {
    const code = new Array(12).fill('foo();').join('\n')
    expect(await uncoveredLines(code, () => 0)).toEqual([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ])
  })
})

describe('Cov8 Plug', () => {
  const sourceDir = '@/workspaces/cov8/test/sources'
  let coverageDataDir: AbsolutePath
  let sources: Files
  let covered: Files

  beforeAll(async () => {
    coverageDataDir = mkdtemp()
    sources = await find('**/*.([cm])?[tj]s', { directory: sourceDir })
    covered = await merge([ sources ]).filter('!**/sourcemap.([cm])?js')

    const files = await merge([ sources ]).filter('!**/*.([cm])?ts')
    for (const file of files.absolutePaths()) {
      log.info('Executing', file)
      await exec(process.execPath, file, { coverageDir: coverageDataDir })
    }
  })

  afterAll(async () => {
    if (coverageDataDir) await rmrf(coverageDataDir)
  })

  it('should fail when no coverage files were found', async () => {
    const emptyCoverageDataDir = mkdtemp()

    try {
      const promise = merge([ covered ])
          .plug(new Coverage(emptyCoverageDataDir))
      await expect(promise).toBeRejectedWithError(BuildFailure)
    } finally {
      await rmrf(emptyCoverageDataDir)
    }
  })

  describe('no reports', () => {
    it('should pass with good coverage', async () => {
      const result = await merge([ covered ])
          .plug(new Coverage(coverageDataDir, {
            optimalCoverage: 50,
            optimalFileCoverage: 50,
          }))
      expect(result).toBeUndefined()
    })

    it('should pass with sub-optimal coverage', async () => {
      const result = await merge([ covered ])
          .plug(new Coverage(coverageDataDir, {
            optimalCoverage: 95,
            optimalFileCoverage: 95,
          }))
      expect(result).toBeUndefined()
    })

    it('should fail when minimum coverage is not met', async () => {
      const promise = merge([ covered ])
          .plug(new Coverage(coverageDataDir, {
            minimumCoverage: 100,
            minimumFileCoverage: 100,
          }))
      await expect(promise).toBeRejectedWithError(BuildFailure)
    })
  })

  describe('with reports', () => {
    let reportDir: AbsolutePath

    beforeEach(async () => {
      reportDir = mkdtemp()
    })

    afterEach(async () => {
      if (reportDir) await rmrf(reportDir)
    })

    it('should pass with good coverage', async () => {
      const result = await merge([ covered ])
          .plug(new Coverage(coverageDataDir, {
            optimalCoverage: 50,
            optimalFileCoverage: 50,
            reportUncoveredLines: true,
            reportDir,
          }))
      expect(result).toHaveProperty('length', (e) => e.toBeGreaterThan(0))

      const reports = await find('**/*.*', { directory: reportDir })
      expect([ ...result! ]).toEqual([ ...reports ])
    })

    it('should pass with sub-optimal coverage', async () => {
      const result = await merge([ covered ])
          .plug(new Coverage(coverageDataDir, {
            optimalCoverage: 95,
            optimalFileCoverage: 95,
            reportUncoveredLines: true,
            reportDir,
          }))

      const reports = await find('**/*.*', { directory: reportDir })
      expect([ ...result! ]).toEqual([ ...reports ])
    })

    it('should fail when minimum coverage is not met', async () => {
      const promise = merge([ covered ])
          .plug(new Coverage(coverageDataDir, {
            minimumCoverage: 100,
            minimumFileCoverage: 100,
            reportUncoveredLines: true,
            reportDir,
          }))
      await expect(promise).toBeRejectedWithError(BuildFailure)
    })
  })

  describe('coverage bias', () => {
    it('should produce coverage wih "none" source map bias', async () => {
      await merge([ covered ])
          .plug(new Coverage(coverageDataDir, {
            optimalCoverage: 50,
            optimalFileCoverage: 50,
            sourceMapBias: 'none',
          }))
    })

    it('should produce coverage wih "greatest_lower_bound" source map bias', async () => {
      await merge([ covered ])
          .plug(new Coverage(coverageDataDir, {
            optimalCoverage: 50,
            optimalFileCoverage: 50,
            sourceMapBias: 'greatest_lower_bound',
          }))
    })

    it('should produce coverage wih "least_upper_bound" source map bias', async () => {
      await merge([ covered ])
          .plug(new Coverage(coverageDataDir, {
            optimalCoverage: 50,
            optimalFileCoverage: 50,
            sourceMapBias: 'least_upper_bound',
          }))
    })
  })

  it('should install the "coverage" plug', async () => {
    expect(merge([]).coverage).toBeUndefined()
    await import('../src/index.ts')
    expect(merge([]).coverage).toBeA('function')
  })
})
