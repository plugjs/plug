import assert from 'node:assert'

import { merge } from '@plugjs/plug'

import { Tsd } from '../src/tsd'

describe('Tsd', () => {
  it('should install the "tsd" plug', async () => {
    const pipe1 = merge([])
    assert(typeof pipe1.tsd === 'undefined', 'Tsd already installed')
    await import('../src/index')
    const pipe2 = merge([])
    assert(typeof pipe2.tsd === 'function', 'Tsd not installed')
  })

  it('should work', async () => {
    void Tsd
  })
})
