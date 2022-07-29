import { build, TaskCall } from './src/build'
import { coverage } from './src/coverage/coverage'
import { log } from './src/log'
import { debug } from './src/plugs/debug'
import { esbuild } from './src/plugs/esbuild'
import { exec } from './src/plugs/exec'
import { find } from './src/run'

// log.options.level = 'DEBUG'
// log.options.depth = 10

const b = build({
  async compile_sources() {
    find('**/*.ts', { directory: 'src' })
      .plug(esbuild({ outdir: 'build/src' }))
      // .plug(debug())
  },
  async compile_tests() {
    await this.compile_sources()
    find('**/*.ts', { directory: 'test' })
      .plug(esbuild({ outdir: 'build/test' }))
      // .plug(debug())
    },
  async test() {
    // this.call('compile_tests')
    //   // .plug(debug())
    //   .plug(exec({ cmd: 'ls', args: ['-la'] }))
    //   .plug(exec('mocha'))
  },
  async default() {
    this.compile_sources()
    this.compile_tests()

    find('src/**/*.ts')
      .plug(coverage({
        coverageDir: './coverage',
        reportDir: './coverage',
        // minimumFileCoverage: 20,
        // optimalCoverage: 50,
      }))
      // .plug(debug())
  }
})

log.info('Build starting...').sep()

b.default()
  .then((result) => log.info('All done!', result))
  .catch((error) => log.error('Build error', error))
