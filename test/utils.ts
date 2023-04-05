import assert from 'node:assert'

import { ExpectationError } from '../src/expectation/types'

export function expectPass(expectation: () => void): void {
  assert.doesNotThrow(expectation)
}

export function expectFail(expectation: () => void, message: string): void {
  assert.throws(expectation, (thrown) => {
    assert(thrown instanceof ExpectationError)
    assert.strictEqual(thrown.message, message)
    return true
  })
}
