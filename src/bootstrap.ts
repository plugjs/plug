import { build } from './build'
import { coverage } from './coverage/coverage'
import { log } from './log'
import { debug } from './plugs/debug'
import { esbuild } from './plugs/esbuild'
import { exec } from './plugs/exec'

// log.options.level = 'DEBUG'
// log.options.depth = 10

function sleep(ms: number = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
    await this.find('src/**/*.ts', {
      // directory: '../justus/',
    })
      // .plug(debug())
      .plug(coverage({
        // coverageDir: '../justus/v8_coverage'
        coverageDir: './coverage'
      }))
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
