import assert from 'node:assert'

import { expect } from '../src/expectation/expect'
import { ExpectationError } from '../src/expectation/types'

import type { Expectations } from '../src/expectation/expect'
import type { ExpectationsContext } from '../src/expectation/types'

describe('Expectations Core', () => {
  it('core expectations method', () => {
    const obj = {} // unique
    const positive = expect(obj)
    const negative = positive.not

    // check the value (.not has no "value" but the impl has it)
    assert.strictEqual(positive.value, obj)
    assert.strictEqual((negative as any).value, obj)

    // check double negation (not.not does not exist, but still the impl has it)
    assert.strictEqual((negative as any).not, positive)
    assert.strictEqual((negative as any).not.not, negative)
    assert.strictEqual((positive as any).not, negative)
    assert.strictEqual((positive as any).not.not, positive)
  })

  describe('expectations error constructor', () => {
    const mock: ExpectationsContext = {
      value: undefined,
      _negative: false,
      _expectations: null as any,
      _negated: null as any,
      forValue: function <V>(): Expectations<V> {
        throw new Error('Function not implemented.')
      },
      forProperty: function(): Expectations<unknown> {
        throw new Error('Function not implemented.')
      },
    }

    const context0: ExpectationsContext = {
      ...mock,
      value: /the value/,
    }

    const context1: ExpectationsContext = {
      ...mock,
      value: 'another value',
      _parent: { context: context0, prop: 'the prop' },
    }

    const context2: ExpectationsContext = {
      ...mock,
      value: 'yet another value',
      _parent: { context: context1, prop: 'another prop' },
    }

    const contexta: ExpectationsContext = {
      ...mock,
      value: 'value a',
    }

    const contextb: ExpectationsContext = {
      ...mock,
      value: 'value b',
      _parent: { context: contexta, prop: 'prop' },
    }

    it('should construct a simple expectation error', () => {
      const error0 = new ExpectationError(context0, 'to be testing')
      assert.strictEqual(error0.message, 'Expected /the value/ to be testing')

      const error1 = new ExpectationError(context0, 'to be testing', true)
      assert.strictEqual(error1.message, 'Expected /the value/ not to be testing')

      const error2 = new ExpectationError({ ...context0, _negative: true }, 'to be testing')
      assert.strictEqual(error2.message, 'Expected /the value/ not to be testing')

      const error3 = new ExpectationError({ ...context0, _negative: true }, 'to be testing', false)
      assert.strictEqual(error3.message, 'Expected /the value/ to be testing')
    })

    it('should construct a simple expectation error for a child property (1)', () => {
      const error0 = new ExpectationError(context1, 'to be testing')
      assert.strictEqual(error0.message, 'Expected property ["the prop"] of [RegExp] ("another value") to be testing')

      const error1 = new ExpectationError(context1, 'to be testing', true)
      assert.strictEqual(error1.message, 'Expected property ["the prop"] of [RegExp] ("another value") not to be testing')
    })

    it('should construct a simple expectation error for a child property (2)', () => {
      const error0 = new ExpectationError(contextb, 'to be testing')
      assert.strictEqual(error0.message, 'Expected property ["prop"] of "value a" ("value b") to be testing')

      const error1 = new ExpectationError(contextb, 'to be testing', true)
      assert.strictEqual(error1.message, 'Expected property ["prop"] of "value a" ("value b") not to be testing')
    })

    it('should construct a simple expectation error for a nested child property', () => {
      const error0 = new ExpectationError(context2, 'to be testing')
      assert.strictEqual(error0.message, 'Expected property ["the prop"]["another prop"] of [RegExp] ("yet another value") to be testing')

      const error1 = new ExpectationError(context2, 'to be testing', true)
      assert.strictEqual(error1.message, 'Expected property ["the prop"]["another prop"] of [RegExp] ("yet another value") not to be testing')
    })

    it('should construct with a diff', () => {
      const diff = { diff: true, value: 'foo', error: 'This is a test' }

      const error0 = new ExpectationError(context0, 'to be testing')
      assert.strictEqual(error0.message, 'Expected /the value/ to be testing')
      assert.strictEqual(error0.diff, undefined)

      const error1 = new ExpectationError(context0, 'to be testing', diff)
      assert.strictEqual(error1.message, 'Expected /the value/ to be testing')
      assert.strictEqual(error1.diff, diff)

      const error2 = new ExpectationError(context0, 'to be testing', true)
      assert.strictEqual(error2.message, 'Expected /the value/ not to be testing')
      assert.strictEqual(error2.diff, undefined)

      const error3 = new ExpectationError(context0, 'to be testing', diff, true)
      assert.strictEqual(error3.message, 'Expected /the value/ not to be testing')
      assert.strictEqual(error3.diff, diff)
    })
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
