import { build, find, merge } from '@plugjs/plug'
import { assert } from '@plugjs/plug/asserts'

import { ESLint } from '../src/eslint'

export default build({
  async test_basic() {
    await find('test.js', { directory: '@/data' })
        .plug(new ESLint())
  },

  async test_warnings() {
    await find('test.js', { directory: '@/data' })
        .plug(new ESLint('@/data/eslint-warnings.cjs'))
  },

  async test_errors() {
    await find('test-multiline.js', { directory: '@/data' })
        .plug(new ESLint({ configFile: '@/data/eslint-errors.cjs' }))
        .then(() => assert(false, 'This should throw'), () => void 0)
  },

  async test_failure() {
    await find('test.js', { directory: '@/data' })
        .plug(new ESLint({ configFile: '@/data/eslint-failure.cjs', directory: '@/data' }))
        .then(() => assert(false, 'This should throw'), () => void 0)
  },

  async test_install() {
    const pipe1 = merge([])
    assert(typeof pipe1.eslint === 'undefined', 'ESLint already installed')
    await import('../src/index')
    const pipe2 = merge([])
    assert(typeof pipe2.eslint === 'function', 'ESLint not installed')
  },

  async test(): Promise<void> {
    await this.test_basic()
    await this.test_warnings()
    await this.test_errors()
    await this.test_failure()
    await this.test_install()
  },
})
