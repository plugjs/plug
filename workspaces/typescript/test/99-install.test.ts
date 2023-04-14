import { merge } from '@plugjs/plug'

describe('TypeScript Plug installation', () => {
  it('should install the "tsc" plug', async () => {
    const pipe1 = merge([])
    expect(pipe1.tsc).toBeUndefined()
    await import('../src/index')
    const pipe2 = merge([])
    expect(pipe2.tsc).toBeDefined()
  })
})
