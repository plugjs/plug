import { assert } from '@plugjs/plug'

describe('Mocha Setup', () => {
  it('should validate the setup code', async function() {
    const delta = Date.now() - (<any> globalThis)['__testing__']
    assert(!isNaN(delta), 'Not a number')
    assert(delta >= 0, 'Too small')
    assert(delta < 99, 'Too big')
  })
})
