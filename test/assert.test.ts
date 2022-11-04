import { expect } from 'chai'

import { assert, assertPromises, BuildFailure, isBuildFailure } from '../src/asserts'

describe('Assertions', () => {
  it('should create a build failure', () => {
    const failure = BuildFailure.fail()
    expect(failure).to.be.instanceof(BuildFailure)
    expect(isBuildFailure(failure)).to.be.true
  })

  it('should create a build failure with a message', () => {
    const failure = BuildFailure.withMessage('Hello, world!')
    expect(failure).to.be.instanceof(BuildFailure)
    expect(isBuildFailure(failure)).to.be.true
    expect(failure.message).to.equal('Hello, world!')
  })

  it('should create a build failure with root causes', () => {
    const error1 = new Error('Error number one')
    const error2 = new Error('Error number two')

    const failure = BuildFailure.withErrors([ error1, error2 ])
    expect(failure).to.be.instanceof(BuildFailure)
    expect(isBuildFailure(failure)).to.be.true
    expect(failure.message).to.equal('')
    expect(failure.errors).to.eql([ error1, error2 ])
  })

  it('should assert a build failure', () => {
    expect(() => assert(true, 'True assertion')).not.to.throw()
    expect(() => assert(false, 'False assertion')).to.throw(BuildFailure, 'False assertion')
  })

  it('should assert some promises', async () => {
    const error1 = new Error('Error number one')
    const error2 = new Error('Error number two')

    const p1 = Promise.resolve('foo')
    const p2 = Promise.resolve('bar')
    const pX = Promise.reject(error1)
    const pY = Promise.reject(error2)

    await expect(assertPromises([ p1, p2 ])).to.eventually.eql([ 'foo', 'bar' ])
    const failure = await expect(assertPromises([ p1, p2, pX, pY ]))
        .to.be.rejectedWith(BuildFailure, '')

    expect(failure).to.be.instanceof(BuildFailure)
    expect(isBuildFailure(failure)).to.be.true
    expect(failure.message).to.equal('')
    expect(failure.errors).to.eql([ error1, error2 ])
  })
})
