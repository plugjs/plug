import { BuildFailure, find, merge } from '@plugjs/plug'

import { ESLint } from '../src/eslint'

describe('ESLint Plug', () => {
  it('should lint some files', async () => {
    await find('test.js', { directory: '@/data' })
        .plug(new ESLint())
  })

  it('should lint some files with warnings', async () => {
    await find('test.js', { directory: '@/data' })
        .plug(new ESLint('@/data/eslint-warnings.cjs'))
  })

  it('should lint some files with errors', async () => {
    const promise = find('test-multiline.js', { directory: '@/data' })
        .plug(new ESLint({ configFile: '@/data/eslint-errors.cjs' }))
    await expect(promise).toBeRejectedWithError(BuildFailure)
  })

  it('should fail on eslint failure', async () => {
    const promise = find('test.js', { directory: '@/data' })
        .plug(new ESLint({ configFile: '@/data/eslint-failure.cjs', directory: '@/data' }))
    await expect(promise).toBeRejectedWithError(BuildFailure)
  })

  it('should install the "eslint" plug', async () => {
    expect(merge([]).eslint).toBeUndefined()
    await import('../src/index')
    expect(merge([]).eslint).toBeA('function')
  })
})
