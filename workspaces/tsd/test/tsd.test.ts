import { BuildFailure, find, merge } from '@plugjs/plug'

import { Tsd } from '../src/tsd'

describe('Tsd', () => {
  const dataDir = '@/workspaces/tsd/test/data'

  it('should succeed with only passing tests', async () => {
    await find('**/passing.test-d.ts', { directory: dataDir })
        .plug(new Tsd({ cwd: dataDir }))
  })

  it('should fail including failing tests', async () => {
    await expect(find('**/*.test-d.ts', { directory: dataDir })
        .plug(new Tsd({ cwd: dataDir, typingsFile: `${dataDir}/index.d.ts` })))
        .toBeRejectedWithError(BuildFailure)
  })

  it('should fail with an incorrect typings file', async () => {
    await expect(find('**/*.test-d.ts', { directory: dataDir })
        .plug(new Tsd({ cwd: dataDir, typingsFile: `${dataDir}/does-not-exist.d.ts` })))
        .toBeRejectedWithError(Error, /The type definition `does-not-exist.d.ts` does not exist/)
  })

  it('should install the "tsd" plug', async () => {
    expect(merge([]).tsd).toBeUndefined()
    await import('../src/index')
    expect(merge([]).tsd).toBeA('function')
  })
})
