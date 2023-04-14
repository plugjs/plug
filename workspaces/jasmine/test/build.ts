import { assert, build, find, merge } from '@plugjs/plug'

import { Jasmine } from '../src/jasmine'

export default build({
  async test_reporter() {
    await find('reporter.test.ts', { directory: '@' }).plug(new Jasmine())
  },

  async test_asserts() {
    await find('asserts.test.ts', { directory: '@' }).plug(new Jasmine())
  },

  async test_setup() {
    await find('setup.test.ts', { directory: '@' }).plug(new Jasmine({
      setup: '@/setup.ts',
    }))
  },

  async test_install() {
    const pipe1 = merge([])
    assert(typeof pipe1.jasmine === 'undefined', 'Jasmine already installed')
    await import('../src/index')
    const pipe2 = merge([])
    assert(typeof pipe2.jasmine === 'function', 'Jasmine not installed')
  },

  async test_nospecs() {
    // really, this file _must not_ exist
    await find('notfound.test.ts', { directory: '@' }).plug(new Jasmine())
  },

  async ['jasmine test'](): Promise<void> {
    await this.test_asserts().then(() => assert(false, 'Should not pass'), () => void 0)
    await this.test_reporter().then(() => assert(false, 'Should not pass'), () => void 0)
    await this.test_nospecs().then(() => assert(false, 'Should not pass'), () => void 0)
    await this.test_setup()
    await this.test_install()
  },
})
