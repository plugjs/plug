import assert from 'node:assert'

import { ExpectationError } from '../src/expectation/types'

import type { Diff } from '../src/expectation/diff'

export function expectPass(expectation: () => void): void {
  try {
    expectation()
    return
  } catch (error) {
    assert.strictEqual(error, undefined)
  }
}

export function expectFail(expectation: () => void, message: string, diff?: Diff): void {
  assert.throws(expectation, (thrown) => {
    assert(thrown instanceof ExpectationError, 'Error type')
    assert.strictEqual(thrown.message, message)
    if (diff) assert.deepEqual(thrown.diff, diff)
    if ((! diff) && thrown.diff) assert.deepEqual(thrown.diff, diff, 'Error diff missing')
    return true
  })
}
