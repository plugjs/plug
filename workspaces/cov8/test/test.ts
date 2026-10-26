import { writeFile } from 'node:fs/promises'

import { BuildFailure, exec, find, merge, mkdtemp, rmrf } from '@plugjs/plug'
import { getLogger } from '@plugjs/plug/logging'
import { resolveAbsolutePath } from '@plugjs/plug/paths'

import { Coverage } from '../src/coverage.ts'
import { coverageReport } from '../src/report.ts'

import type { AbsolutePath, Files } from '@plugjs/plug'
import type { CoverageAnalyser } from '../src/analysis.ts'

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
