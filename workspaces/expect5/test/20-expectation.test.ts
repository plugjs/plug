import assert from 'node:assert'

import { expect } from '../src/expectation/expect'
import { ExpectationError } from '../src/expectation/types'

describe('Expectations Core', () => {
  it('should negate properly', () => {
    const positive = expect('foo')
    const negative = positive.not

    // check caches and double negation
    assert.strictEqual(negative.not, positive)
    assert.strictEqual(negative.not.not, negative)
    assert.strictEqual(positive.not, negative)
    assert.strictEqual(positive.not.not, positive)
  })
})

describe('Asynchronous Expectations', () => {
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

  it('should expect "not.toBeResolved(...)"', async () => {
    await expect(Promise.reject(new Error('foo'))).not.toBeResolved()

    await assert.rejects(expect(Promise.resolve('foo')).not.toBeResolved(), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected [Promise] not to be resolved')
      return true
    })
  })

  it('should expect "not.toBeRejected(...)"', async () => {
    await expect(Promise.resolve('foo')).not.toBeRejected()

    await assert.rejects(expect(Promise.reject(new Error('foo'))).not.toBeRejected(), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected [Promise] not to be rejected')
      return true
    })
  })

  it('should expect "not.toBeRejectedWithError(...)"', async () => {
    await expect(Promise.resolve('foo')).not.toBeRejectedWithError()

    await assert.rejects(expect(Promise.reject(new Error('foo'))).not.toBeRejectedWithError(), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected [Promise] not to be rejected')
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
