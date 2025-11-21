import assert from 'node:assert'

import { expect } from '../src/expectation/expect'
import { expectFail, expectPass } from './utils'

describe('Throwing Expectations', () => {
  it('should expect "toThrow(...)"', () => {
    const error = new SyntaxError('Whatever')
    const throwing = (): never => {
      throw error
    }

    // no parameters
    expectPass(() => expect(throwing).toThrow())
    expectFail(() => expect(() => {}).toThrow(), 'Expected <function> to throw')

    // with expectations matcher
    expectPass(() => expect(throwing).toThrow(expect.toStrictlyEqual(error)))
    expectFail(() => expect(throwing).toThrow(expect.toStrictlyEqual('foo')),
        'Expected [SyntaxError] to strictly equal "foo"', {
          diff: true,
          value: error,
          expected: 'foo',
        })

    // with assertion function
    let asserted: any = undefined
    expectPass(() => expect(throwing).toThrow((e) => asserted = e.value))
    assert.strictEqual(asserted, error)

    // even when throwing undefined
    function throwUndefined(): never {
      // eslint-disable-next-line no-throw-literal
      throw undefined
    }

    asserted = 'bogus!'
    expectPass(() => expect(throwUndefined).toThrow(expect.toBeUndefined()))
    expectPass(() => expect(throwUndefined).toThrow((assert) => asserted = assert.value))
    assert.strictEqual(asserted, undefined)
  })

  it('should expect "toThrowError(...)"', () => {
    const error = new SyntaxError('Whatever')
    const throwing = (): never => {
      throw error
    }

    expectFail(() => expect(() => {}).toThrowError(), 'Expected <function> to throw')
    expectFail(() => expect(() => {}).toThrowError(), 'Expected <function> to throw')

    expectPass(() => expect(throwing).toThrowError)
    expectPass(() => expect(throwing).toThrowError())
    expectPass(() => expect(throwing).toThrowError(Error))
    expectPass(() => expect(throwing).toThrowError(SyntaxError))
    expectPass(() => expect(throwing).toThrowError('Whatever'))
    expectPass(() => expect(throwing).toThrowError(/Whatever/))
    expectPass(() => expect(throwing).toThrowError('hateve', true)) // substring
    expectPass(() => expect(throwing).toThrowError(Error, 'Whatever'))
    expectPass(() => expect(throwing).toThrowError(Error, /Whatever/))
    expectPass(() => expect(throwing).toThrowError(SyntaxError, 'Whatever'))
    expectPass(() => expect(throwing).toThrowError(SyntaxError, /Whatever/))

    expectFail(() => expect(throwing).toThrowError(TypeError), 'Expected [SyntaxError] to be an instance of [TypeError]')
    expectFail(() => expect(throwing).toThrowError('hateve'), 'Expected property ["message"] of [SyntaxError] ("Whatever") to strictly equal "hateve"', {
      diff: true,
      value: error,
      props: {
        message: {
          diff: true,
          value: 'Whatever',
          expected: 'hateve',
        },
      },
    })
    expectFail(() => expect(throwing).toThrowError(/nope/), 'Expected property ["message"] of [SyntaxError] ("Whatever") to match /nope/')

    expectFail(() => expect(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'not-an-error'
    }).toThrowError(), 'Expected "not-an-error" to be an instance of [Error]')
  })

  it('should expect "not.toThrow(...)"', () => {
    const error = new SyntaxError('Whatever')
    const throwing = (): never => {
      throw error
    }

    expectPass(() => expect(() => {}).not.toThrow())
    expectFail(() => expect(throwing).not.toThrow(), 'Expected <function throwing> not to throw')
  })

  it('should restrict "toThrow(...)", "toThrowError(...)" and "not.toThrow()" to functions', () => {
    expectFail(() => expect('foo').toThrow(), 'Expected "foo" to be a <function>')
    expectFail(() => expect('foo').toThrowError(), 'Expected "foo" to be a <function>')
    expectFail(() => expect('foo').not.toThrow(), 'Expected "foo" to be a <function>')
  })
})
