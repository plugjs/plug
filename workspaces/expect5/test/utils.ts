import assert from 'node:assert'

import { ExpectationError } from '../src/expectation/types'

import type { Diff } from '../src/expectation/diff'

export function expectPass(expectation: () => void): void {
  try {
    expectation()
    return
  } catch (error: any) {
    const ctor = Object.getPrototypeOf(error).constructor.name
    assert.fail(`Passing expectation threw ${ctor}: ${error.message}`)
  }
}

export function expectFail(expectation: () => void, message: string, diff?: Diff): void {
  assert.throws(expectation, (thrown) => {
    assert(thrown instanceof ExpectationError, 'Error type')
    assert.strictEqual(thrown.message, message)
    if (diff && (! thrown.diff)) assert.fail('Expected diff, error had none')
    if ((! diff) && thrown.diff) assert.fail('Error had diff, but none provided to check')
    if (diff && thrown.diff) assert.deepEqual(thrown.diff, diff)
    return true
  })
}
