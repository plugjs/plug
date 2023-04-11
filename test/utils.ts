import assert from 'node:assert'

import { ExpectationError } from '../src/expectation/types'

import type { Diff } from '../src/expectation/diff'

export function expectPass(expectation: () => void): void {
  assert.doesNotThrow(expectation)
}

export function expectFail(expectation: () => void, message: string, diff?: Diff): void {
  assert.throws(expectation, (thrown) => {
    assert(thrown instanceof ExpectationError, 'Error type')
    assert.strictEqual(thrown.message, message, 'Error message')
    if (diff) assert.deepEqual(thrown.diff, diff, 'Error diff mismatch')
    if ((! diff) && thrown.diff) assert.deepEqual(thrown.diff, diff, 'Error diff missing')
    return true
  })
}
