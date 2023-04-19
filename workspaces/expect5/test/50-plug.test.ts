import { BuildFailure, find, merge } from '@plugjs/plug'

import '../src/globals' // side-effect: when recompiling we don't loose globals
import { Test } from '../src/test'

describe('Expect5 Plug', async () => {
  const directory = '@/workspaces/expect5/test/data'

  it('should run a suite', async () => {
    await merge([ find('simple.ts', { directory } ) ]).plug(new Test())
  })

  it('should run a suite with skipped specs', async () => {
    await merge([ find('skips.ts', { directory } ) ]).plug(new Test())
  })

  it('should fail a suite with failing "beforeEach" hooks', async () => {
    await expect(merge([ find('fail-each.ts', { directory } ) ]).plug(new Test()))
        .toBeRejectedWithError(BuildFailure, '')
  })

  it('should fail a suite with failing "beforeAll" hooks', async () => {
    await expect(merge([ find('fail-all.ts', { directory } ) ]).plug(new Test()))
        .toBeRejectedWithError(BuildFailure, '')
  })

  it('should fail a suite with failing specs', async () => {
    await expect(merge([ find('fail-spec.ts', { directory } ) ]).plug(new Test()))
        .toBeRejectedWithError(BuildFailure, '')
  })

  it('should fail a suite with errors', async () => {
    await expect(merge([ find('errors.ts', { directory } ) ]).plug(new Test()))
        .toBeRejectedWithError(BuildFailure, '')
  })

  it('should fail a suite with chai assertion errors', async () => {
    await expect(merge([ find('errors-chai.ts', { directory } ) ]).plug(new Test()))
        .toBeRejectedWithError(BuildFailure, '')
  })

  it('should fail a suite with chai assertion errors (no diffs)', async () => {
    await expect(merge([ find('errors-chai-nodiff.ts', { directory } ) ]).plug(new Test({
      genericErrorDiffs: false,
    }))).toBeRejectedWithError(BuildFailure, '')
  })

  it('should fail a suite with node assertion errors', async () => {
    await expect(merge([ find('errors-assert.ts', { directory } ) ]).plug(new Test()))
        .toBeRejectedWithError(BuildFailure, '')
  })

  it('should fail a suite with node assertion errors (no diffs)', async () => {
    await expect(merge([ find('errors-assert-nodiff.ts', { directory } ) ]).plug(new Test({
      genericErrorDiffs: false,
    }))).toBeRejectedWithError(BuildFailure, '')
  })

  it('should fail a suite with only specs', async () => {
    await expect(merge([ find('only.ts', { directory } ) ]).plug(new Test()))
        .toBeRejectedWithError(BuildFailure, 'Suite running in focus ("only") mode')
  })
})
