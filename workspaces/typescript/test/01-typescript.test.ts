import { BuildFailure, Files, find, merge, resolve } from '@plugjs/plug'

import { Tsc } from '../src/typescript'

describe('TypeScript Basics', () => {
  it('should fail when parsing a bad "tsconfig.json" file', async () => {
    const promise = find('**/*.ts', { directory: '@/data' })
        .plug(new Tsc('@/data/bad.tsconfig.json'))

    await expect(promise).toBeRejectedWithError(BuildFailure)
  })

  it('should check some sources', async () => {
    const result = await find('**/*.ts', { directory: '@/data' })
        .plug(new Tsc())

    expect(result).toHaveLength(0)
  })

  it('should honor extra types from a directory', async () => {
    const promise = find('**/*.ts', { directory: '@/extra/src' })
        .plug(new Tsc())
    await expect(promise).toBeRejectedWithError(BuildFailure)

    const result = await find('**/*.ts', { directory: '@/extra/src' })
        .plug(new Tsc({ extraTypesDir: '@/extra/types' }))
    await expect(result).toHaveLength(0)
  })

  it('should fail when an input file was not found', async () => {
    const files = Files.builder(resolve('@/data')).add('missing.ts').build()
    const pipe = merge([ files ])

    const promise = pipe.plug(new Tsc())
    await expect(promise).toBeRejectedWithError(BuildFailure)
  })
})
