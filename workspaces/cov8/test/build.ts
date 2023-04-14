import { assert, build, exec, find, log, merge, rmrf } from '@plugjs/plug'

import { Coverage } from '../src/coverage'

import type { Pipe } from '@plugjs/plug'


export default build({
  coverageDir: '.coverage-test-data',

  find_sources() {
    return find('**/*.([cm])?[tj]s', { directory: '@/sources' })
  },

  find_covered(): Pipe {
    return this.find_sources().filter('!**/sourcemap.([cm])?js')
  },

  async test_no_files() {
    await this.find_covered()
        .plug(new Coverage(this.coverageDir))
        .then(() => assert(false, 'This should fail'), () => void 0)
  },

  async generate() {
    const files = await this.find_sources().filter('!**/*.([cm])?ts')

    for (const file of files.absolutePaths()) {
      log('Executing', file)
      await exec(process.execPath, file, { coverageDir: this.coverageDir })
    }
  },

  async no_report() {
    await this.find_covered()
        .plug(new Coverage(this.coverageDir))
        .then((result) => assert(result === undefined, 'Files produced by coverage'))

    await this.find_covered()
        .plug(new Coverage(this.coverageDir, {
          optimalCoverage: 95,
          optimalFileCoverage: 95,
        }))
        .then((result) => assert(result === undefined, 'Files produced by coverage'))

    await this.find_covered()
        .plug(new Coverage(this.coverageDir, {
          minimumCoverage: 100,
          minimumFileCoverage: 100,
        }))
        .then(() => assert(false, 'This should fail'), () => void 0)
  },

  async with_report() {
    await this.find_covered()
        .plug(new Coverage(this.coverageDir, {
          reportDir: `${this.coverageDir}/coverage-ok`,
        }))
        .then((result) => assert(result !== undefined, 'No files produced by coverage'))

    await this.find_covered()
        .plug(new Coverage(this.coverageDir, {
          reportDir: `${this.coverageDir}/coverage-meh`,
          optimalCoverage: 95,
          optimalFileCoverage: 95,
        }))
        .then((result) => assert(result !== undefined, 'No files produced by coverage'))

    await this.find_covered()
        .plug(new Coverage(this.coverageDir, {
          reportDir: `${this.coverageDir}/coverage-bad`,
          minimumCoverage: 100,
          minimumFileCoverage: 100,
        }))
        .then(() => assert(false, 'This should fail'), () => void 0)
  },

  async coverage_bias() {
    await this.find_covered()
        .plug(new Coverage(this.coverageDir, { sourceMapBias: 'none' }))
    await this.find_covered()
        .plug(new Coverage(this.coverageDir, { sourceMapBias: 'greatest_lower_bound' }))
    await this.find_covered()
        .plug(new Coverage(this.coverageDir, { sourceMapBias: 'least_upper_bound' }))
  },

  async test_install() {
    const pipe1 = merge([])
    assert(typeof pipe1.coverage === 'undefined', 'Cov8 already installed')
    // @ts-ignore
    await import('../src/index')
    const pipe2 = merge([])
    assert(typeof pipe2.coverage === 'function', 'Cov8 not installed')
  },

  async test(): Promise<void> {
    await rmrf(this.coverageDir)

    await this.test_no_files()

    await this.generate()

    await this.no_report()
    await this.with_report()
    await this.coverage_bias()

    await this.test_install()
  },
})
