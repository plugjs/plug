import { assert, assertPromises, BuildFailure, isBuildFailure } from '../src/asserts'

describe('Assertions', () => {
  it('should create a build failure', () => {
    const failure = BuildFailure.fail()
    expect(failure).toBeInstanceOf(BuildFailure)
    expect(isBuildFailure(failure)).toBeTrue
  })

  it('should create a build failure with a message', () => {
    const failure = BuildFailure.withMessage('Hello, world!')
    expect(failure).toBeInstanceOf(BuildFailure)
    expect(isBuildFailure(failure)).toBeTrue
    expect(failure.message).toBe('Hello, world!')
  })

  it('should create a build failure with root causes', () => {
    const error1 = new Error('Error number one')
    const error2 = new Error('Error number two')

    const failure = BuildFailure.withErrors([ error1, error2 ])
    expect(failure).toBeInstanceOf(BuildFailure)
    expect(isBuildFailure(failure)).toBeTrue
    expect(failure.message).toBe('')
    expect(failure.errors).toEqual([ error1, error2 ])
  })

  it('should assert a build failure', () => {
    expect(() => assert(true, 'True assertion')).not.toThrow()
    expect(() => assert(false, 'False assertion'))
        .toThrowError(BuildFailure as any, 'False assertion')
  })

  it('should assert some promises', async () => {
    const error1 = new Error('Error number one')
    const error2 = new Error('Error number two')

    const p1 = Promise.resolve('foo')
    const p2 = Promise.resolve('bar')
    const pX = Promise.reject(error1)
    const pY = Promise.reject(error2)

    await expectAsync(assertPromises([ p1, p2 ])).toBeResolvedTo([ 'foo', 'bar' ])

    const promise = assertPromises([ p1, p2, pX, pY ])
    await expectAsync(promise).toBeRejected()

    const failure = await promise.catch((error) => error)
    expect(failure).toBeInstanceOf(BuildFailure)
    expect(isBuildFailure(failure)).toBeTrue
    expect(failure.message).toBe('')
    expect(failure.errors).toEqual([ error1, error2 ])
  })
})
