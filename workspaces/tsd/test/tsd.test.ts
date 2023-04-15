import { BuildFailure, find, merge } from '@plugjs/plug'

import { Tsd } from '../src/tsd'

describe('Tsd', () => {
  it('should succeed with only passing tests', async () => {
    await find('**/passing.test-d.ts', { directory: '@/data' })
        .plug(new Tsd({ cwd: '@/data' }))
  })

  it('should fail including failing tests', async () => {
    await expect(find('**/*.test-d.ts', { directory: '@/data' })
        .plug(new Tsd({ cwd: '@/data', typingsFile: '@/data/index.d.ts' })))
        .toBeRejectedWithError(BuildFailure)
  })

  it('should fail with an incorrect typings file', async () => {
    await expect(find('**/*.test-d.ts', { directory: '@/data' })
        .plug(new Tsd({ cwd: '@/data', typingsFile: '@/data/does-not-exist.d.ts' })))
        .toBeRejectedWithError(Error, /The type definition `does-not-exist.d.ts` does not exist/)
  })

  it('should install the "tsd" plug', async () => {
    expect(merge([]).tsd).toBeUndefined()
    await import('../src/index')
    expect(merge([]).tsd).toBeA('function')
  })
})
