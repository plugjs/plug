import { build } from './src/build'
import { coverage } from './src/coverage/coverage'
import { log } from './src/log'
import { debug } from './src/plugs/debug'
import { esbuild } from './src/plugs/esbuild'
import { exec } from './src/plugs/exec'

// log.options.level = 'DEBUG'
// log.options.depth = 10


const b = build({
  async compile_sources() {
    this.find('src/**/*.ts')
      // .plug(debug())
      .plug(esbuild({ outdir: 'build' }))
      // .plug(debug())
  },
  async compile_tests() {
    await this.call('compile_sources')
    this.find('test/**/*.ts')
      // .plug(debug())
      .plug(esbuild({ outdir: 'build' }))
      // .plug(debug())
  },
  async test() {
    this.call('compile_tests')
      // .plug(debug())
      .plug(exec({ cmd: 'ls', args: ['-la'] }))
      .plug(exec('mocha'))
  },
  async default() {
    console.log('HERE1')
    this.find('src/**/*.ts', {
      // directory: '../justus/',
    })
      .plug(debug())
      .plug(coverage({
        // coverageDir: '../justus/v8_coverage'
        coverageDir: './coverage',
        reportDir: './coverage',
        //minimumFileCoverage: 20,
        //optimalCoverage: 50,
      }))
    console.log('HERE2')
      // await sleep()
    // await this.call('compile_sources')
    // await sleep()
    // await this.call('compile_tests')
    // await sleep()
    // await this.call('test')
    // await sleep()
  }
})

log.info('Build starting...').sep()

b.default()
  .then((result) => log.info('All done!', result))
  .catch((error) => log.error('Build error', error))
