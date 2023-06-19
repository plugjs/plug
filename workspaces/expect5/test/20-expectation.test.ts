import assert from 'node:assert'

import { expect } from '../src/expectation/expect'
import { ExpectationError } from '../src/expectation/types'

describe('ExpectationError constructor', () => {
  const expectations0 = expect(/the value/)

  const expectations1 = Object.assign(expect('another value'), {
    parent: { expectations: expectations0, prop: 'the prop' },
  })

  const expectations2 = Object.assign(expect('yet another value'), {
    parent: { expectations: expectations1, prop: 'another prop' },
  })

  const expectationsa = expect('value a')
  const expectationsb = Object.assign(expect('value b'), {
    parent: { expectations: expectationsa, prop: 'prop' },
  })

  it('should construct a simple expectation error', () => {
    const error0 = new ExpectationError(expectations0, 'to be testing')
    assert.strictEqual(error0.message, 'Expected /the value/ to be testing')
  })

  it('should construct a simple expectation error for a child property (1)', () => {
    const error0 = new ExpectationError(expectations1, 'to be testing')
    assert.strictEqual(error0.message, 'Expected property ["the prop"] of [RegExp] ("another value") to be testing')
  })

  it('should construct a simple expectation error for a child property (2)', () => {
    const error0 = new ExpectationError(expectationsb, 'to be testing')
    assert.strictEqual(error0.message, 'Expected property ["prop"] of "value a" ("value b") to be testing')
  })

  it('should construct a simple expectation error for a nested child property', () => {
    const error0 = new ExpectationError(expectations2, 'to be testing')
    assert.strictEqual(error0.message, 'Expected property ["the prop"]["another prop"] of [RegExp] ("yet another value") to be testing')
  })

  it('should construct with a diff', () => {
    const diff = { diff: true, value: 'foo', error: 'This is a test' }

    const error0 = new ExpectationError(expectations0, 'to be testing')
    assert.strictEqual(error0.message, 'Expected /the value/ to be testing')
    assert.strictEqual(error0.diff, undefined)

    const error1 = new ExpectationError(expectations0, 'to be testing', diff)
    assert.strictEqual(error1.message, 'Expected /the value/ to be testing')
    assert.strictEqual(error1.diff, diff)
  })

  it('should construct with some remarks', () => {
    const expectationsx = expect(/the value/)
    assert.strictEqual(expectationsx.remarks, undefined)
    const errorx = new ExpectationError(expectationsx, 'to be testing')
    assert.strictEqual(errorx.message, 'Expected /the value/ to be testing')
    assert.strictEqual(errorx.remarks, undefined)

    const expectationsy = expect(/the value/, '') // empty string
    assert.strictEqual(expectationsy.remarks, '') // empty string preserved
    const errory = new ExpectationError(expectationsy, 'to be testing')
    assert.strictEqual(errory.message, 'Expected /the value/ to be testing')
    assert.strictEqual(errory.remarks, undefined) // empty string stripped

    const expectationsz = expect(/the value/, 'Hello, world!')
    assert.strictEqual(expectationsz.remarks, 'Hello, world!')
    const errorz = new ExpectationError(expectationsz, 'to be testing')
    assert.strictEqual(errorz.message, 'Expected /the value/ to be testing')
    assert.strictEqual(errorz.remarks, 'Hello, world!')
  })
})
