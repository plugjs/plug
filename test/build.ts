import { build, find } from '@plugjs/plug'
import { assert } from '@plugjs/plug/asserts'

import { ESLint } from '../src/runner'

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

  async test(): Promise<void> {
    await this.test_basic()
    await this.test_warnings()
    await this.test_errors()
    await this.test_failure()
  },
})
