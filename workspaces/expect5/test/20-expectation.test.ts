import assert from 'node:assert'

import { expect } from '../src/expectation/expect'
import { ExpectationError } from '../src/expectation/types'

fdescribe('ExpectationError constructor', () => {
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
})

fdescribe('Asynchronous Expectations', () => {
  it('should expect "toBeResolved(...)"', async () => {
    const expectation = expect(Promise.resolve('foo'))

    // should be simply resolved...
    const promise = expectation.toBeResolved()
    assert(promise instanceof Promise)
    assert.strictEqual(await promise, expectation)

    // should also pass assertions through
    let assertions: any = undefined
    await expect(Promise.resolve('foo')).toBeResolved((assert) => void (assertions = assert))
    assert.strictEqual(assertions.value, 'foo')

    // rejections
    await assert.rejects(expect(Promise.reject(new Error('foo'))).toBeResolved(), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected [Promise] to be resolved')
      return true
    })
  })

  it('should expect "toBeRejected(...)"', async () => {
    const error = new Error('foo')
    const expectation = expect(Promise.reject(error))

    // should be simply resolved...
    const promise = expectation.toBeRejected()
    assert(promise instanceof Promise)
    assert.strictEqual(await promise, expectation)

    // should also pass assertions through
    let assertions: any = undefined
    await expect(Promise.reject(error)).toBeRejected((assert) => void (assertions = assert))
    assert.strictEqual(assertions.value, error)

    // rejections
    await assert.rejects(expect(Promise.resolve('foo')).toBeRejected(), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected [Promise] to be rejected')
      return true
    })
  })

  it('should expect "toBeRejectedWithError(...)"', async () => {
    const error = new SyntaxError('foo')
    const expectation = expect(Promise.reject(error))

    // should be simply resolved...
    const promise = expectation.toBeRejectedWithError()
    assert(promise instanceof Promise)
    assert.strictEqual(await promise, expectation)

    // passing...
    await expect(Promise.reject(error)).toBeRejectedWithError('foo')
    await expect(Promise.reject(error)).toBeRejectedWithError(/foo/)
    await expect(Promise.reject(error)).toBeRejectedWithError(SyntaxError)
    await expect(Promise.reject(error)).toBeRejectedWithError(SyntaxError, 'foo')
    await expect(Promise.reject(error)).toBeRejectedWithError(SyntaxError, /foo/)

    // rejections
    await assert.rejects(expect(Promise.resolve('foo')).toBeRejectedWithError(), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected [Promise] to be rejected')
      return true
    })

    await assert.rejects(expect(Promise.reject(error)).toBeRejectedWithError(TypeError), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected [SyntaxError] to be an instance of [TypeError]')
      return true
    })

    // eslint-disable-next-line prefer-promise-reject-errors
    await assert.rejects(expect(Promise.reject('foo')).toBeRejectedWithError(), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected "foo" to be an instance of [Error]')
      return true
    })
  })

  it('should restrict "toBeResolved" and "toBeRejected" to promises', async () => {
    await assert.rejects(expect('foo').toBeResolved(), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected "foo" to have property "then"')
      return true
    })

    await assert.rejects(expect({ then: 'foo' }).toBeResolved(), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected property ["then"] of [Object] ("foo") to be a <function>')
      return true
    })

    await assert.rejects(expect('foo').toBeRejected(), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected "foo" to have property "then"')
      return true
    })

    await assert.rejects(expect({ then: 'foo' }).toBeRejected(), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected property ["then"] of [Object] ("foo") to be a <function>')
      return true
    })
  })
})
