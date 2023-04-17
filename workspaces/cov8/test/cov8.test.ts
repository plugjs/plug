import { BuildFailure, exec, find, merge, mkdtemp, rmrf } from '@plugjs/plug'

import { Coverage } from '../src/coverage'

import type { AbsolutePath, Files } from '@plugjs/plug'

describe('ESLint Plug', () => {
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
    await import('../src/index')
    expect(merge([]).coverage).toBeA('function')
  })
})
