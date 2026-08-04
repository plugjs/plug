import { merge } from '@plugjs/plug'

describe('Expect5 Plug Installation', () => {
  it('should install the "test" plug', async () => {
    expect(merge([]).test).toBeUndefined()
    await import('../src/index.ts')
    expect(merge([]).test).toBeA('function')
  })
})
