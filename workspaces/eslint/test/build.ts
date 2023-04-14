import { build, find, merge } from '@plugjs/plug'
import { assert } from '@plugjs/plug/asserts'

import { ESLint } from '../src/eslint'

export default build({
  async ['basic eslint test']() {
    await find('test.js', { directory: '@/data' })
        .plug(new ESLint())
  },

  async ['warnings eslint test']() {
    await find('test.js', { directory: '@/data' })
        .plug(new ESLint('@/data/eslint-warnings.cjs'))
  },

  async ['errors eslint test']() {
    await find('test-multiline.js', { directory: '@/data' })
        .plug(new ESLint({ configFile: '@/data/eslint-errors.cjs' }))
        .then(() => assert(false, 'This should throw'), () => void 0)
  },

  async ['failure eslint test']() {
    await find('test.js', { directory: '@/data' })
        .plug(new ESLint({ configFile: '@/data/eslint-failure.cjs', directory: '@/data' }))
        .then(() => assert(false, 'This should throw'), () => void 0)
  },

  async ['install eslint test']() {
    const pipe1 = merge([])
    assert(typeof pipe1.eslint === 'undefined', 'ESLint already installed')
    await import('../src/index')
    const pipe2 = merge([])
    assert(typeof pipe2.eslint === 'function', 'ESLint not installed')
  },

  async ['eslint test'](): Promise<void> {
    await this['basic eslint test']()
    await this['warnings eslint test']()
    await this['errors eslint test']()
    await this['failure eslint test']()
    await this['install eslint test']()
  },
})
