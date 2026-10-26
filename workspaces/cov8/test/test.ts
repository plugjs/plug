import { realpath, writeFile } from 'node:fs/promises'

import { BuildFailure, exec, find, merge, mkdtemp, rmrf } from '@plugjs/plug'
import { getLogger } from '@plugjs/plug/logging'
import { resolveAbsolutePath } from '@plugjs/plug/paths'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'

import { createAnalyser } from '../src/analysis.ts'
import { Coverage } from '../src/coverage.ts'
import { COVERAGE_SKIPPED, coverageReport } from '../src/report.ts'

import type { AbsolutePath, Files } from '@plugjs/plug'
import type { CoverageAnalyser } from '../src/analysis.ts'
import type { CoverageResult } from '../src/report.ts'

describe('Runtime TypeScript declarations', () => {
  async function analyse(code: string): Promise<CoverageResult> {
    const directory = await realpath(mkdtemp()) as AbsolutePath
    let analyser: CoverageAnalyser | undefined
    try {
      const file = resolveAbsolutePath(directory, 'source.ts')
      const script = resolveAbsolutePath(directory, 'source.cjs')
      const coverageDir = resolveAbsolutePath(directory, 'coverage')
      await writeFile(file, code)
      const { outputText } = transpileModule(code, {
        fileName: file,
        compilerOptions: {
          module: ModuleKind.CommonJS,
          target: ScriptTarget.ES2022,
          inlineSourceMap: true,
          inlineSources: true,
        },
      })
      await writeFile(script, outputText)
      await exec(process.execPath, script, { coverageDir })
      const coverageFiles = await find('coverage-*.json', { directory: coverageDir })
      analyser = await createAnalyser([ file ], [ ...coverageFiles.absolutePaths() ], 'least_upper_bound', getLogger())
      const report = await coverageReport(analyser, [ file ], getLogger())
      return report.results[file]!
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
})

describe('Uncovered lines', () => {
  async function uncoveredLines(code: string, coverage: CoverageAnalyser['coverage']): Promise<number[]> {
    const directory = mkdtemp()
    try {
      const file = resolveAbsolutePath(directory, 'source.ts')
      await writeFile(file, code)
      const report = await coverageReport({ coverage, destroy() {} }, [ file ], getLogger())
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
