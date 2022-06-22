import { describe, it } from '../src/test'

describe('Basic test', () => {
  it('Test number one', () => {
    console.log('This goes to standard output')
  })

  describe('Test number two', () => {
    it('Test 2A', () => {})
    it.skip('Test 2B', () => {})
    it('Test 2C', () => {})
    it('Test 2D', () => {})
  })

  it('This test fails', () => {
    throw new Error('FooBar')
  })

  it('Test number three', () => {
    console.error('This goes to standard error')
  })
})
