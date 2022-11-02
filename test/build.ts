import { build, find } from '@plugjs/plug'

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

  async test(): Promise<void> {
    await this.test_reporter()
    await this.test_setup()
    await this.test_failure()
  },
})
