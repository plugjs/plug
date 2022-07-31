import { build } from './src/build'
import { coverage } from './src/coverage/coverage'
import { log } from './src/log'
import { esbuild } from './src/plugs/esbuild'
import { find } from './src/run'

// log.options.level = 'DEBUG'
// log.options.depth = 10

const b = build({
  async compile_sources() {
    await find('**/*.ts', { directory: 'src' })
        .plug(esbuild({ outdir: 'build/src' }))
        // .plug(debug())
  },
  async compile_tests() {
    await this.compile_sources()
    await find('**/*.ts', { directory: 'test' })
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
    await this.compile_sources()
    await this.compile_tests()

    await find('src/**/*.ts')
        .plug(coverage({
          coverageDir: './coverage',
          reportDir: './coverage',
          // minimumFileCoverage: 20,
          // optimalCoverage: 50,
        }))
        // .plug(debug())
  },
})

log.info('Build starting...').sep()

b.default()
    .then((result) => log.info('All done!', result))
    .catch((error) => log.error('Build error', error))
