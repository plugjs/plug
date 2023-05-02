import { expect as chai } from 'chai'

describe('A test suite (errors-chai-nodiff)', () => {
  it('should throw a chai assertion error (1)', () => {
    chai({ foo: 'bar' }).to.eql({ foo: 'baz' })
  })

  it('should throw a chai assertion error (2)', () => {
    chai(123).to.be.greaterThan(200)
  })

  it('should throw a chai assertion error (3)', () => {
    chai(123, 'This is a custom message').to.equal(321)
  })
})
