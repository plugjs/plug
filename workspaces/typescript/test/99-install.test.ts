import { merge } from '@plugjs/plug'

describe('TypeScript Plug installation', () => {
  it('should install the "tsc" plug', async () => {
    expect(merge([]).tsc).toBeUndefined()
    await import('../src/index')
    expect(merge([]).tsc).toBeA('function')
  })
})
