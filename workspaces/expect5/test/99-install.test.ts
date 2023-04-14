import { merge } from '@plugjs/plug'

describe('Expect5 Plug Installation', () => {
  it('should install the "zip" plug', async () => {
    const pipe1 = merge([])
    expect(pipe1.test).toBeUndefined()
    await import('../src/index')
    const pipe2 = merge([])
    expect(pipe2.test).toBeDefined()
  })
})
