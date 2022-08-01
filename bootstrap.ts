import { build } from './src/build'
// import { coverage } from './src/coverage/coverage'
import { log } from './src/log'
import { esbuild } from './src/plugs/esbuild'
import { find } from './src/run'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type * as d from './src/plugs/debug'
// import './src/plugs/debug'

// log.options.level = 'DEBUG'
// log.options.depth = 10

const b0 = build({
  async foo() {
    return find('**')
  },
  async bar() {
    await find('**')
  },
})


const b = build({
  ...b0,

  async compile_sources() {
    await find('**/*.ts', { directory: 'src' })
        .plug(esbuild({ outdir: 'build/src' }))
        // .plug(debug())
    // return 'foo'
  },
  async compile_tests() {
    await this.compile_sources()
    return find('**/*.ts', { directory: 'test' })
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
    const r1 = this.compile_sources()
    const r2 = this.compile_tests()
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    void r1, r2


    // await find('src/**/*.ts')
    //     .plug(coverage({
    //       coverageDir: './coverage',
    //       reportDir: './coverage',
    //       // minimumFileCoverage: 20,
    //       // optimalCoverage: 50,
    //     }))
    //     .debug()
    //     // .plug(debug())

    // return r2
  },
})

log.info('Build starting...').sep()

// const pX = b.foo.task
// const pY = b.bar.task


// const p1 = b.default.task
// const p2 = b.compile_tests.task

b.default()
    .then((result) => log.info('All done!', result))
    .catch((error) => log.error('Build error', error))
