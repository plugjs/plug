import { assert, build, find, merge } from '@plugjs/plug'

import { Test } from '../src/test'

export default build({
  async ['self expect5 test']() {
    await find('*.test.ts', { directory: '@' }).plug(new Test())
  },

  async ['install expect5 test']() {
    const pipe1 = merge([])
    assert(typeof pipe1.test === 'undefined', 'Expect5 already installed')
    await import('../src/index')
    const pipe2 = merge([])
    assert(typeof pipe2.test === 'function', 'Expect5 not installed')
  },

  async ['expect5 test'](): Promise<void> {
    await this['self expect5 test']()
    await this['install expect5 test']()
  },
})
