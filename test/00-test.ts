import { describe, it } from '../src/test'

describe('X) Basic test', () => {
  it('1) Test number one', () => {
    //console.log('> Test number one')
  })

  describe('2) Test number two', () => {
    it('2A) Test 2A', () => {})
    it.skip('2B) Test 2B', () => {})
    it('2C) Test 2C', () => {})
    it('2D) Test 2D', () => {})
  })

  it('3) This test fails', () => {
    throw new Error('FooBar')
  })

  it('4) Test number three', () => {
    // console.error('This goes to standard error')
  })
})
