import { expect as e } from '../src/expectation/expect'
import { ExpectationError } from '../src/expectation/types'

describe('Basic Expectations', () => {
  it('should expect "toBeA(...)"', () => {
    expect(() => e('foo').toBeA('string')).not.toThrow()
    expect(() => e('foo').toBeA('number')).toThrowError(ExpectationError, 'Expected "foo" to be a <number>')

    expect(() => e('foo').not.toBeA('number')).not.toThrow()
    expect(() => e('foo').not.toBeA('string')).toThrowError(ExpectationError, 'Expected "foo" not to be a <string>')
  })

  it('should expect "toBeInstanceOf(...)"', () => {
    const error = new TypeError()

    expect(() => e(error).toBeInstanceOf(Error)).not.toThrow()
    expect(() => e(error).toBeInstanceOf(TypeError)).not.toThrow()
    expect(() => e(error).toBeInstanceOf(SyntaxError)).toThrowError(ExpectationError, 'Expected [TypeError] to be an instance of SyntaxError')

    expect(() => e(error).not.toBeInstanceOf(Error)).toThrowError(ExpectationError, 'Expected [TypeError] not to be an instance of Error')
    expect(() => e(error).not.toBeInstanceOf(TypeError)).toThrowError(ExpectationError, 'Expected [TypeError] not to be an instance of TypeError')
    expect(() => e(error).not.toBeInstanceOf(SyntaxError)).not.toThrow()
  })
})
