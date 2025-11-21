import assert from 'node:assert'

import { expect } from '../src/expectation/expect'
import { ExpectationError } from '../src/expectation/types'

describe('Asynchronous Expectations', () => {
  it('should expect "toBeRejected(...)"', async () => {
    const error = new Error('foo')
    const expectation = expect(Promise.reject(error))

    // should be simply rejected...
    const promise = expectation.toBeRejected()
    assert(promise instanceof Promise)
    assert.strictEqual(await promise, expectation)

    // should also pass assertions through
    let assertions: any = undefined
    await expectation.toBeRejected((assert) => assertions = assert)
    assert.strictEqual(assertions.value, error)

    // rejections
    await assert.rejects(expect(Promise.resolve('foo')).toBeRejected(), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected [Promise] to be rejected')
      return true
    })

    // should be rejected and match the error _precisely_...
    await expectation.toBeRejected(expect.toStrictlyEqual(error))
    await assert.rejects(expectation.toBeRejected(expect.toStrictlyEqual('foo')), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected [Error] to strictly equal "foo"')
      return true
    })
  })

  it('should expect "toBeRejectedWith(...)"', async () => {
    const error0 = new Error('foo')
    const error1 = new Error('foo') // same, but not _strictly_ equal
    error0.stack = error1.stack = error0.stack // make stacks same, too

    const expectation = expect(Promise.reject(error0))

    // should be simply resolved...
    const promise0 = expectation.toBeRejectedWith(error0)
    assert(promise0 instanceof Promise)
    assert.strictEqual(await promise0, expectation)

    // rejections with resolved promise (d'oh!)
    await assert.rejects(expect(Promise.resolve('foo')).toBeRejectedWith(error0),
        (reason) => {
          assert(reason instanceof ExpectationError)
          assert.strictEqual(reason.message, 'Expected [Promise] to be rejected')
          return true
        })

    // rejections with same error, but different instance
    await assert.rejects(expect(Promise.reject(error1)).toBeRejectedWith(error0),
        (reason) => {
          assert(reason instanceof ExpectationError)
          assert.strictEqual(reason.message, 'Expected [Error] to strictly equal [Error]')
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
    await expect(Promise.reject(error)).toBeRejectedWithError('o', true) // substring
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

  /* ======================================================================== */

  it('should expect "toBeResolved(...)"', async () => {
    const expectation = expect(Promise.resolve('foo'))

    // should be simply resolved...
    const promise = expectation.toBeResolved()
    assert(promise instanceof Promise)
    assert.strictEqual(await promise, expectation)

    // should also pass assertions through
    let assertions: any = undefined
    await expectation.toBeResolved((assert) => assertions = assert)
    assert.strictEqual(assertions.value, 'foo')

    // rejections
    await assert.rejects(expect(Promise.reject(new Error('foo'))).toBeResolved(), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected [Promise] to be resolved')
      return true
    })

    // should be resolved and match the result _precisely_...
    await expectation.toBeResolved(expect.toStrictlyEqual('foo'))
    await assert.rejects(expectation.toBeResolved(expect.toStrictlyEqual('bar')), (reason) => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected "foo" to strictly equal "bar"')
      return true
    })
  })

  it('should expect "toBeResolvedWith(...)"', async () => {
    // should be resolved with something strictly equal...
    const expectation0 = expect(Promise.resolve('foo'))
    const promise0 = expectation0.toBeResolvedWith('foo')
    assert(promise0 instanceof Promise)
    assert.strictEqual(await promise0, expectation0)

    // should be resolved with something deeply equal...
    const expectation1 = expect(Promise.resolve({ foo: 'bar' }))
    const promise1 = expectation1.toBeResolvedWith({ foo: 'bar' })
    assert(promise1 instanceof Promise)
    assert.strictEqual(await promise1, expectation1)

    // should be resolved with something deeply equal (with matchers)...
    const expectation2 = expect(Promise.resolve({ foo: 'bar' }))
    const promise2 = expectation2.toBeResolvedWith({ foo: expect.toBeA('string') })
    assert(promise2 instanceof Promise)
    assert.strictEqual(await promise2, expectation2)

    // rejection for resolved
    await assert.rejects(expect(Promise.reject(new Error('foo'))).toBeResolvedWith('foo'),
        (reason) => {
          assert(reason instanceof ExpectationError)
          assert.strictEqual(reason.message, 'Expected [Promise] to be resolved')
          return true
        })

    // rejection for not equal
    await assert.rejects(expect(Promise.resolve('foo')).toBeResolvedWith('bar'),
        (reason) => {
          assert(reason instanceof ExpectationError)
          assert.strictEqual(reason.message, 'Expected "foo" to equal "bar"')
          assert.deepEqual(reason.diff, {
            diff: true,
            value: 'foo',
            expected: 'bar',
          })
          return true
        })

    // rejection for not equal with matchers
    await assert.rejects(expect(Promise.resolve({ foo: 'bar' })).toBeResolvedWith({ foo: expect.toBeA('number') }),
        (reason) => {
          assert(reason instanceof ExpectationError)
          assert.strictEqual(reason.message, 'Expected [Object] to equal [Object]')
          assert.deepEqual(reason.diff, {
            diff: true,
            value: { foo: 'bar' },
            props: {
              foo: {
                diff: true,
                value: 'bar',
                error: 'Expected "bar" to be a <number>',
              },
            },
          })
          return true
        })
  })

  /* ======================================================================== */

  it('should restrict async expectations to promises', async () => {
    const notThenable = (reason: any): true => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected "foo" to have property "then"')
      return true
    }
    const notThenFunction = (reason: any): true => {
      assert(reason instanceof ExpectationError)
      assert.strictEqual(reason.message, 'Expected property ["then"] of [Object] ("foo") to be a <function>')
      return true
    }

    await assert.rejects(expect('foo').toBeRejected(), notThenable)
    await assert.rejects(expect('foo').toBeRejectedWith(new Error()), notThenable)
    await assert.rejects(expect('foo').toBeRejectedWithError(), notThenable)
    await assert.rejects(expect('foo').toBeResolved(), notThenable)
    await assert.rejects(expect('foo').toBeResolvedWith('foo'), notThenable)

    await assert.rejects(expect({ then: 'foo' }).toBeRejected(), notThenFunction)
    await assert.rejects(expect({ then: 'foo' }).toBeRejectedWith(new Error()), notThenFunction)
    await assert.rejects(expect({ then: 'foo' }).toBeRejectedWithError(), notThenFunction)
    await assert.rejects(expect({ then: 'foo' }).toBeResolved(), notThenFunction)
    await assert.rejects(expect({ then: 'foo' }).toBeResolvedWith('foo'), notThenFunction)
  })
})
