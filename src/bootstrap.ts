import { build } from './build'
import { log } from './log'
import { debug } from './plugs/debug'
import { esbuild } from './plugs/esbuild'
import { test } from './plugs/test'

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
    this.call('compile_sources')
    this.find('test/**/*.ts')
      // .plug(debug())
      .plug(esbuild({ outdir: 'build' }))
      // .plug(debug())
  },
  async test() {
    this.call('compile_tests')
      // .plug(debug())
      .plug(test())
  },
  async default() {
    this.parallel('compile_tests' , 'test')
  }
})

b.default()
  .then((result) => log.info('All done!', result))
  .catch((error) => log.error('Build error', error))
