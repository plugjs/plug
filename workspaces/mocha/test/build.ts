import { assert, build, find, merge } from '@plugjs/plug'

import { Mocha } from '../src/mocha'

export default build({
  async test_reporter() {
    await find('reporter.ts', { directory: '@' }).plug(new Mocha({}))
  },

  async test_setup() {
    await find('setup-test.ts', { directory: '@' }).plug(new Mocha({
      require: '@/setup-before.ts',
    }))
  },

  async test_failure() {
    await find('failure.ts', { directory: '@' }).plug(new Mocha({}))
        .catch(() => {})
  },

  async test_install() {
    const pipe1 = merge([])
    assert(typeof pipe1.mocha === 'undefined', 'Mocha already installed')
    await import('../src/index')
    const pipe2 = merge([])
    assert(typeof pipe2.mocha === 'function', 'Mocha not installed')
  },

  async test(): Promise<void> {
    await this.test_reporter()
    await this.test_setup()
    await this.test_failure()
    await this.test_install()
  },
})
