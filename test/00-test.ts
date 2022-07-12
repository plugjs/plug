import { describe, it } from '../src/test'
import { log } from '../src/log'

describe('Basic test', () => {
  it('Test number one', (context) => {
    // console.log('This goes to standard output')
    log.trace('Hello, trace!')
    log.debug('Hello, debug!')
    log.info('Hello, info!')
    log.warn('Hello, warn!')
    log.error('Hello, error!', new SyntaxError('FooBarBaz'))
    // console.log(new SyntaxError('Gonzooo!'))
  })

  describe('Test number two', () => {
    it('Test 2A', () => {})
    it.skip('Test 2B', () => {})
    it('Test 2C', () => {})
    it('Test 2D', () => {})
  })

  it('This test fails', () => {
    throw new SyntaxError('FooBar')
  })

  it('Test number three', () => {
    // console.error('This\ngoes\nto\nstandard\nerror')
  })
})
