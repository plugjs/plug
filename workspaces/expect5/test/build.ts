import { assert, build, find, merge } from '@plugjs/plug'

import { Test } from '../src/test'

export default build({
  async test_self() {
    await find('*.test.ts', { directory: '@' }).plug(new Test())
  },

  async test_install() {
    const pipe1 = merge([])
    assert(typeof pipe1.test === 'undefined', 'Expect5 already installed')
    // @ts-ignore
    await import('../src/index')
    const pipe2 = merge([])
    assert(typeof pipe2.test === 'function', 'Expect5 not installed')
  },

  async test(): Promise<void> {
    await this.test_self()
    await this.test_install()
  },
})
