import { merge } from '@plugjs/plug'

describe('TypeScript Plug installation', () => {
  it('should install the "tsc" and "tscBuild" plugs', async () => {
    expect(merge([]).tsc).toBeUndefined()
    expect(merge([]).tscBuild).toBeUndefined()
    await import('../src/index')
    expect(merge([]).tsc).toBeA('function')
    expect(merge([]).tscBuild).toBeA('function')
  })
})
