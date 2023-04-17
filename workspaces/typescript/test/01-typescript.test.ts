import { BuildFailure, Files, find, merge, resolve } from '@plugjs/plug'

import { Tsc } from '../src/typescript'

describe('TypeScript Basics', () => {
  const testDir = '@/workspaces/typescript/test'

  it('should fail when parsing a bad "tsconfig.json" file', async () => {
    const promise = find('**/*.ts', { directory: `${testDir}/data` })
        .plug(new Tsc(`${testDir}/data/bad.tsconfig.json`))

    await expect(promise).toBeRejectedWithError(BuildFailure)
  })

  it('should check some sources', async () => {
    const result = await find('**/*.ts', { directory: `${testDir}/data` })
        .plug(new Tsc())

    expect(result).toHaveLength(0)
  })

  it('should honor extra types from a directory', async () => {
    const promise = find('**/*.ts', { directory: `${testDir}/extra/src` })
        .plug(new Tsc())
    await expect(promise).toBeRejectedWithError(BuildFailure)

    const result = await find('**/*.ts', { directory: `${testDir}/extra/src` })
        .plug(new Tsc({ extraTypesDir: `${testDir}/extra/types` }))
    await expect(result).toHaveLength(0)
  })

  it('should fail when an input file was not found', async () => {
    const files = Files.builder(resolve(`${testDir}/data`)).add('missing.ts').build()
    const pipe = merge([ files ])

    const promise = pipe.plug(new Tsc())
    await expect(promise).toBeRejectedWithError(BuildFailure)
  })
})
