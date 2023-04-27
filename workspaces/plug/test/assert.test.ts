import { expect as expect4, expect5 } from '@plugjs/expect5/expectation/expect'

import { assert, assertPromises, BuildFailure, fail } from '../src/asserts'

describe('Assertions', () => {
  it('should create a build failure', () => {
    const failure = BuildFailure.fail()
    expect(failure).toBeInstanceOf(BuildFailure)
  })

  it('should create a build failure with a message', () => {
    const failure = BuildFailure.withMessage('Hello, world!')
    expect(failure).toBeInstanceOf(BuildFailure)
    expect(failure.message).toStrictlyEqual('Hello, world!')

    const q = expect5('foo').toBeA('array', (a) => a.toBeA('string')).value
    const w = expect5('foo').not.toBeA()

    expect4('foo').toEqual({
      bar: expect.toHaveLength(12),
      foo: expect.toBeA('number', (assert) => {
        assert
      }),
    }).value
  })

  it('should create a build failure with root causes', () => {
    const error1 = new Error('Error number one')
    const error2 = new Error('Error number two')

    const failure = BuildFailure.withErrors([ error1, error2 ])

    expect(failure).toBeInstanceOf(BuildFailure)
    expect(failure.message).toStrictlyEqual('')
    expect(failure.errors).toEqual([ error1, error2 ])
  })

  it('should assert a build failure', () => {
    expect(() => assert(true, 'True assertion')).not.toThrow()
    expect(() => assert(false, 'False assertion'))
        .toThrowError(BuildFailure, 'False assertion')
  })

  it('should fail when told to do so', () => {
    expect(() => fail('Hello, world!'))
        .toThrowError(BuildFailure, 'Hello, world!')
  })

  it('should assert some promises', async () => {
    const error1 = new Error('Error number one')
    const error2 = new Error('Error number two')

    const p1 = Promise.resolve('foo')
    const p2 = Promise.resolve('bar')
    const pX = Promise.reject(error1)
    const pY = Promise.reject(error2)

    const result = await assertPromises([ p1, p2 ])
    expect(result).toEqual([ 'foo', 'bar' ])

    const promise = assertPromises([ p1, p2, pX, pY ])
    await expect(promise).toBeRejected()

    const failure = await promise.catch((error) => error)
    expect(failure).toBeInstanceOf(BuildFailure)
    expect(failure.message).toStrictlyEqual('')
    expect(failure.errors).toEqual([ error1, error2 ])
  })
})
