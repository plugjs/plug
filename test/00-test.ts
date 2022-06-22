import { describe, it } from '../src/test'

describe('Basic test', () => {
  it('Test number one', (context) => {
    console.log('This goes to standard output')
    context.log.trace('Hello, trace!')
    context.log.debug('Hello, debug!')
    context.log.info('Hello, info!')
    context.log.warn('Hello, warn!')
    context.log.error('Hello, error!', new Error('FooBarBaz'))
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
    console.error('This\ngoes\nto\nstandard\nerror')
  })
})
