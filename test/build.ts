import { assert, build, merge } from '@plugjs/plug'

import { Coverage } from '../src/coverage'

export default build({

  async test_install() {
    const pipe1 = merge([])
    assert(typeof pipe1.coverage === 'undefined', 'Cov8 already installed')
    // @ts-ignore
    await import('../src/index')
    const pipe2 = merge([])
    assert(typeof pipe2.coverage === 'function', 'Cov8 not installed')
  },

  async test(): Promise<void> {
    void Coverage

    await this.test_install()
  },
})
