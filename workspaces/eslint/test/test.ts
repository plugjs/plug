import { BuildFailure, find, merge } from '@plugjs/plug'

import { ESLint } from '../src/eslint'

describe('ESLint Plug', () => {
  const dataDir = '@/workspaces/eslint/test/data'

  it('should lint some files', async () => {
    await find('test.js', { directory: dataDir })
        .plug(new ESLint())
  })

  it('should lint some files with warnings', async () => {
    await find('test.js', { directory: dataDir })
        .plug(new ESLint(`${dataDir}/eslint-warnings.cjs`))
  })

  it('should lint some files with errors', async () => {
    const promise = find('test-multiline.js', { directory: dataDir })
        .plug(new ESLint({
          configFile: `${dataDir}/eslint-errors.cjs`,
          directory: dataDir,
        }))
    await expect(promise).toBeRejectedWithError(BuildFailure)
  })

  it('should fail on eslint failure', async () => {
    const promise = find('test.js', { directory: dataDir })
        .plug(new ESLint({ configFile: `${dataDir}/eslint-failure.cjs` }))
    await expect(promise).toBeRejectedWithError(BuildFailure)
  })

  it('should install the "eslint" plug', async () => {
    expect(merge([]).eslint).toBeUndefined()
    await import('../src/index')
    expect(merge([]).eslint).toBeA('function')
  })
})
