import assert from 'node:assert'

import { expect } from '../src/expectation/expect'
import { expectFail, expectPass } from './utils'

describe('Basic Expectations', () => {
  it('should expect "toBeA(...)"', () => {
    expectPass(() => expect('foo').toBeA('string'))
    expectFail(() => expect('foo').toBeA('number'), 'Expected "foo" to be a <number>')

    expectPass(() => expect('foo').not.toBeA('number'))
    expectFail(() => expect('foo').not.toBeA('string'), 'Expected "foo" not to be a <string>')
  })

  it('should expect "toBeCloseTo(...)"', () => {
    expectPass(() => expect(2).toBeCloseTo(2, 1))
    expectPass(() => expect(2).toBeCloseTo(2, 0))
    expectPass(() => expect(2).toBeCloseTo(2, -1))
    expectPass(() => expect(2n).toBeCloseTo(2n, 1n))
    expectPass(() => expect(2n).toBeCloseTo(2n, 0n))
    expectPass(() => expect(2n).toBeCloseTo(2n, -1n))

    expectPass(() => expect(4).not.toBeCloseTo(2, 1))
    expectPass(() => expect(4n).not.toBeCloseTo(2n, 1n))

    expectFail(() => expect(4).toBeCloseTo(2, 1), 'Expected 4 to be within 1...3')
    expectFail(() => expect(4n).toBeCloseTo(2n, 1n), 'Expected 4n to be within 1n...3n')

    expectFail(() => expect(2).not.toBeCloseTo(2, 1), 'Expected 2 not to be within 1...3')
    expectFail(() => expect(2).not.toBeCloseTo(2, 0), 'Expected 2 not to be within 2...2')
    expectFail(() => expect(2).not.toBeCloseTo(2, -1), 'Expected 2 not to be within 1...3')
    expectFail(() => expect(2n).not.toBeCloseTo(2n, 1n), 'Expected 2n not to be within 1n...3n')
    expectFail(() => expect(2n).not.toBeCloseTo(2n, 0n), 'Expected 2n not to be within 2n...2n')
    expectFail(() => expect(2n).not.toBeCloseTo(2n, -1n), 'Expected 2n not to be within 1n...3n')

    expectFail(() => expect(3n).toBeCloseTo(3, 1), 'Expected 3n to be a <number>')
    expectFail(() => expect(3).toBeCloseTo(3n, 1n), 'Expected 3 to be a <bigint>')
  })

  it('should expect "toBeError(...)"', () => {
    const error = new SyntaxError('Foo!')

    expectPass(() => expect(error).toBeError())
    expectPass(() => expect(error).toBeError('Foo!'))
    expectPass(() => expect(error).toBeError(/foo/i))
    expectPass(() => expect(error).toBeError(SyntaxError))
    expectPass(() => expect(error).toBeError(SyntaxError, 'Foo!'))
    expectPass(() => expect(error).toBeError(SyntaxError, /foo/i))
    expectPass(() => expect({ message: 'foo' }).toBeError(Object as any, 'foo'))

    expectFail(() => expect('foo').toBeError(), 'Expected "foo" to be an instance of Error')
    expectFail(() => expect(error).toBeError('Bar!'), 'Expected property ["message"] of [SyntaxError] ("Foo!") to strictly equal "Bar!"')
    expectFail(() => expect(error).toBeError(/bar/i), 'Expected property ["message"] of [SyntaxError] ("Foo!") to match /bar/i')
    expectFail(() => expect(error).toBeError(TypeError), 'Expected [SyntaxError] to be an instance of TypeError')
    expectFail(() => expect({ message: 123 }).toBeError(Object as any, '123'), 'Expected property ["message"] of <object> (123) to be a <string>')

    expectFail(() => expect(error).not.toBeError(), 'Expected [SyntaxError] not to be an instance of Error')
    expectFail(() => expect(error).not.toBeError('Foo!'), 'Expected [SyntaxError] not to be an instance of Error')
    expectFail(() => expect(error).not.toBeError(/foo/i), 'Expected [SyntaxError] not to be an instance of Error')
    expectFail(() => expect(error).not.toBeError(SyntaxError), 'Expected [SyntaxError] not to be an instance of SyntaxError')
    expectFail(() => expect(error).not.toBeError(SyntaxError, 'Foo!'), 'Expected [SyntaxError] not to be an instance of SyntaxError')
    expectFail(() => expect(error).not.toBeError(SyntaxError, /foo/i), 'Expected [SyntaxError] not to be an instance of SyntaxError')
    expectFail(() => expect({ message: 'foo' }).not.toBeError(Object as any, 'foo'), 'Expected <object> not to be an instance of Object')

    expectPass(() => expect('foo').not.toBeError())
    expectPass(() => expect(error).not.toBeError(TypeError))
    expectPass(() => expect({ message: 123 }).not.toBeError('123'))
  })

  it('should expect "toBeGreaterThan(...)"', () => {
    expectPass(() => expect(3).toBeGreaterThan(2))
    expectPass(() => expect(3n).toBeGreaterThan(2n))
    expectPass(() => expect(3).not.toBeGreaterThan(3))
    expectPass(() => expect(3n).not.toBeGreaterThan(3n))

    expectFail(() => expect(3).toBeGreaterThan(3), 'Expected 3 to be greater than 3')
    expectFail(() => expect(3n).toBeGreaterThan(3n), 'Expected 3n to be greater than 3n')
    expectFail(() => expect(3).not.toBeGreaterThan(2), 'Expected 3 not to be greater than 2')
    expectFail(() => expect(3n).not.toBeGreaterThan(2n), 'Expected 3n not to be greater than 2n')

    expectFail(() => expect(3n).toBeGreaterThan(2), 'Expected 3n to be a <number>')
    expectFail(() => expect(3).toBeGreaterThan(2n), 'Expected 3 to be a <bigint>')
  })

  it('should expect "toBeGreaterThanOrEqual(...)"', () => {
    expectPass(() => expect(3).toBeGreaterThanOrEqual(3))
    expectPass(() => expect(3n).toBeGreaterThanOrEqual(3n))
    expectPass(() => expect(2).not.toBeGreaterThanOrEqual(3))
    expectPass(() => expect(2n).not.toBeGreaterThanOrEqual(3n))

    expectFail(() => expect(2).toBeGreaterThanOrEqual(3), 'Expected 2 to be greater than or equal to 3')
    expectFail(() => expect(2n).toBeGreaterThanOrEqual(3n), 'Expected 2n to be greater than or equal to 3n')
    expectFail(() => expect(3).not.toBeGreaterThanOrEqual(3), 'Expected 3 not to be greater than or equal to 3')
    expectFail(() => expect(3n).not.toBeGreaterThanOrEqual(3n), 'Expected 3n not to be greater than or equal to 3n')

    expectFail(() => expect(3n).toBeGreaterThanOrEqual(3), 'Expected 3n to be a <number>')
    expectFail(() => expect(3).toBeGreaterThanOrEqual(3n), 'Expected 3 to be a <bigint>')
  })

  it('should expect "toBeInstanceOf(...)"', () => {
    const error = new TypeError()

    expectPass(() => expect(error).toBeInstanceOf(Error))
    expectPass(() => expect(error).toBeInstanceOf(TypeError))
    expectFail(() => expect(error).toBeInstanceOf(SyntaxError), 'Expected [TypeError] to be an instance of SyntaxError')

    expectFail(() => expect(error).not.toBeInstanceOf(Error), 'Expected [TypeError] not to be an instance of Error')
    expectFail(() => expect(error).not.toBeInstanceOf(TypeError), 'Expected [TypeError] not to be an instance of TypeError')
    expectPass(() => expect(error).not.toBeInstanceOf(SyntaxError))
  })

  it('should expect "toBeLessThan(...)"', () => {
    expectPass(() => expect(2).toBeLessThan(3))
    expectPass(() => expect(2n).toBeLessThan(3n))
    expectPass(() => expect(3).not.toBeLessThan(3))
    expectPass(() => expect(3n).not.toBeLessThan(3n))

    expectFail(() => expect(3).toBeLessThan(3), 'Expected 3 to be less than 3')
    expectFail(() => expect(3n).toBeLessThan(3n), 'Expected 3n to be less than 3n')
    expectFail(() => expect(2).not.toBeLessThan(3), 'Expected 2 not to be less than 3')
    expectFail(() => expect(2n).not.toBeLessThan(3n), 'Expected 2n not to be less than 3n')

    expectFail(() => expect(2n).toBeLessThan(3), 'Expected 2n to be a <number>')
    expectFail(() => expect(2).toBeLessThan(3n), 'Expected 2 to be a <bigint>')
  })

  it('should expect "toBeLessThanOrEqual(...)"', () => {
    expectPass(() => expect(3).toBeLessThanOrEqual(3))
    expectPass(() => expect(3n).toBeLessThanOrEqual(3n))
    expectPass(() => expect(3).not.toBeLessThanOrEqual(2))
    expectPass(() => expect(3n).not.toBeLessThanOrEqual(2n))

    expectFail(() => expect(3).toBeLessThanOrEqual(2), 'Expected 3 to be less than or equal to 2')
    expectFail(() => expect(3n).toBeLessThanOrEqual(2n), 'Expected 3n to be less than or equal to 2n')
    expectFail(() => expect(3).not.toBeLessThanOrEqual(3), 'Expected 3 not to be less than or equal to 3')
    expectFail(() => expect(3n).not.toBeLessThanOrEqual(3n), 'Expected 3n not to be less than or equal to 3n')

    expectFail(() => expect(3n).toBeLessThanOrEqual(3), 'Expected 3n to be a <number>')
    expectFail(() => expect(3).toBeLessThanOrEqual(3n), 'Expected 3 to be a <bigint>')
  })

  it('should expect "toBeWithinRange(...)"', () => {
    expectPass(() => expect(2).toBeWithinRange(1, 3))
    expectPass(() => expect(2).toBeWithinRange(3, 1))
    expectPass(() => expect(2).toBeWithinRange(2, 2))
    expectPass(() => expect(2n).toBeWithinRange(1n, 3n))
    expectPass(() => expect(2n).toBeWithinRange(3n, 1n))
    expectPass(() => expect(2n).toBeWithinRange(2n, 2n))

    expectPass(() => expect(3).not.toBeWithinRange(1, 2))
    expectPass(() => expect(3).not.toBeWithinRange(2, 1))
    expectPass(() => expect(3n).not.toBeWithinRange(1n, 2n))
    expectPass(() => expect(3n).not.toBeWithinRange(2n, 1n))

    expectFail(() => expect(3).toBeWithinRange(1, 2), 'Expected 3 to be within 1...2')
    expectFail(() => expect(3).toBeWithinRange(2, 1), 'Expected 3 to be within 1...2')
    expectFail(() => expect(3n).toBeWithinRange(1n, 2n), 'Expected 3n to be within 1n...2n')
    expectFail(() => expect(3n).toBeWithinRange(2n, 1n), 'Expected 3n to be within 1n...2n')

    expectFail(() => expect(2).not.toBeWithinRange(1, 3), 'Expected 2 not to be within 1...3')
    expectFail(() => expect(2).not.toBeWithinRange(3, 1), 'Expected 2 not to be within 1...3')
    expectFail(() => expect(2).not.toBeWithinRange(2, 2), 'Expected 2 not to be within 2...2')
    expectFail(() => expect(2n).not.toBeWithinRange(1n, 3n), 'Expected 2n not to be within 1n...3n')
    expectFail(() => expect(2n).not.toBeWithinRange(3n, 1n), 'Expected 2n not to be within 1n...3n')
    expectFail(() => expect(2n).not.toBeWithinRange(2n, 2n), 'Expected 2n not to be within 2n...2n')

    expectFail(() => expect(3n).toBeWithinRange(3, 3), 'Expected 3n to be a <number>')
    expectFail(() => expect(3).toBeWithinRange(3n, 3n), 'Expected 3 to be a <bigint>')
  })

  it('should expect "toHaveProperty(...)"', () => {
    const s = Symbol()
    const s2 = Symbol()

    expectPass(() => expect('foo').toHaveProperty('length'))
    expectPass(() => expect([ 0 ]).toHaveProperty(0))
    expectPass(() => expect({ [s]: 'foo' }).toHaveProperty(s))

    expectFail(() => expect('foo').not.toHaveProperty('length'), 'Expected "foo" not to have property "length"')
    expectFail(() => expect([ 0 ]).not.toHaveProperty(0), 'Expected <array> not to have property "0"')
    expectFail(() => expect({ [s]: 'foo' }).not.toHaveProperty(s), 'Expected <object> not to have property "Symbol()"')

    expectFail(() => expect('foo').toHaveProperty('bar'), 'Expected "foo" to have property "bar"')
    expectFail(() => expect([ 0 ]).toHaveProperty(1), 'Expected <array> to have property "1"')
    expectFail(() => expect({ [s]: 'foo' }).toHaveProperty(s2), 'Expected <object> to have property "Symbol()"')

    expectPass(() => expect('foo').not.toHaveProperty('bar'))
    expectPass(() => expect([ 0 ]).not.toHaveProperty(1))
    expectPass(() => expect({ [s]: 'foo' }).not.toHaveProperty(s2))

    const object = { foo: { bar: 'baz' } }
    let value: any = undefined
    expectPass(() => expect(object).toHaveProperty('foo', (assert) => value = assert.value))
    assert.strictEqual(value, object.foo)

    value = undefined
    expectPass(() => expect(object).not.toHaveProperty('bar', () => value = 'called'))
    assert.strictEqual(value, undefined)
  })

  it('should expect "toHaveLength(...)"', () => {
    expectPass(() => expect('foo').toHaveLength(3))
    expectPass(() => expect('').toHaveLength(0))
    expectPass(() => expect([]).toHaveLength(0))
    expectPass(() => expect({ length: 123 }).toHaveLength(123))

    expectFail(() => expect('foo').toHaveLength(9), 'Expected property ["length"] of "foo" (3) to strictly equal 9')
    expectFail(() => expect('').toHaveLength(9), 'Expected property ["length"] of "" (0) to strictly equal 9')
    expectFail(() => expect([]).toHaveLength(9), 'Expected property ["length"] of <array> (0) to strictly equal 9')
    expectFail(() => expect({ length: 123 }).toHaveLength(9), 'Expected property ["length"] of <object> (123) to strictly equal 9')

    expectFail(() => expect('foo').not.toHaveLength(3), 'Expected property ["length"] of "foo" (3) not to strictly equal 3')
    expectFail(() => expect('').not.toHaveLength(0), 'Expected property ["length"] of "" (0) not to strictly equal 0')
    expectFail(() => expect([]).not.toHaveLength(0), 'Expected property ["length"] of <array> (0) not to strictly equal 0')
    expectFail(() => expect({ length: 123 }).not.toHaveLength(123), 'Expected property ["length"] of <object> (123) not to strictly equal 123')

    expectPass(() => expect('foo').not.toHaveLength(9))
    expectPass(() => expect('').not.toHaveLength(9))
    expectPass(() => expect([]).not.toHaveLength(9))
    expectPass(() => expect({ length: 123 }).not.toHaveLength(9))

    expectFail(() => expect(null).toHaveLength(123), 'Expected <null> to be defined')
    expectFail(() => expect(null).not.toHaveLength(123), 'Expected <null> to be defined')
    expectFail(() => expect(undefined).toHaveLength(123), 'Expected <undefined> to be defined')
    expectFail(() => expect(undefined).not.toHaveLength(123), 'Expected <undefined> to be defined')

    expectFail(() => expect({}).toHaveLength(123), 'Expected <object> to have property "length"')
    expectFail(() => expect({}).not.toHaveLength(123), 'Expected <object> to have property "length"')
    expectFail(() => expect({ length: 'foo' }).toHaveLength(123), 'Expected property ["length"] of <object> ("foo") to be a <number>')
    expectFail(() => expect({ length: 'foo' }).not.toHaveLength(123), 'Expected property ["length"] of <object> ("foo") to be a <number>')
  })

  it('should expect "toHaveSize(...)"', () => {
    expectPass(() => expect(new Set([ 'foo' ])).toHaveSize(1))
    expectPass(() => expect(new Map([ [ 'foo', 'bar' ] ])).toHaveSize(1))
    expectPass(() => expect({ size: 123 }).toHaveSize(123))

    expectFail(() => expect(new Set([ 'foo' ])).toHaveSize(9), 'Expected property ["size"] of <set> (1) to strictly equal 9')
    expectFail(() => expect(new Map([ [ 'foo', 'bar' ] ])).toHaveSize(9), 'Expected property ["size"] of <map> (1) to strictly equal 9')
    expectFail(() => expect({ size: 123 }).toHaveSize(9), 'Expected property ["size"] of <object> (123) to strictly equal 9')

    expectFail(() => expect(new Set([ 'foo' ])).not.toHaveSize(1), 'Expected property ["size"] of <set> (1) not to strictly equal 1')
    expectFail(() => expect(new Map([ [ 'foo', 'bar' ] ])).not.toHaveSize(1), 'Expected property ["size"] of <map> (1) not to strictly equal 1')
    expectFail(() => expect({ size: 123 }).not.toHaveSize(123), 'Expected property ["size"] of <object> (123) not to strictly equal 123')

    expectPass(() => expect(new Set([ 'foo' ])).not.toHaveSize(9))
    expectPass(() => expect(new Map([ [ 'foo', 'bar' ] ])).not.toHaveSize(9))
    expectPass(() => expect({ size: 123 }).not.toHaveSize(9))

    expectFail(() => expect(null).toHaveSize(123), 'Expected <null> to be defined')
    expectFail(() => expect(null).not.toHaveSize(123), 'Expected <null> to be defined')
    expectFail(() => expect(undefined).toHaveSize(123), 'Expected <undefined> to be defined')
    expectFail(() => expect(undefined).not.toHaveSize(123), 'Expected <undefined> to be defined')

    expectFail(() => expect({}).toHaveSize(123), 'Expected <object> to have property "size"')
    expectFail(() => expect({}).not.toHaveSize(123), 'Expected <object> to have property "size"')
    expectFail(() => expect({ size: 'foo' }).toHaveSize(123), 'Expected property ["size"] of <object> ("foo") to be a <number>')
    expectFail(() => expect({ size: 'foo' }).not.toHaveSize(123), 'Expected property ["size"] of <object> ("foo") to be a <number>')
  })

  it('should expect "toMatch(...)"', () => {
    expectPass(() => expect('foo').toMatch(/^foo$/))
    expectPass(() => expect('foo').toMatch('^foo$'))
    expectFail(() => expect('foo').toMatch(/^bar$/), 'Expected "foo" to match /^bar$/')
    expectFail(() => expect('foo').toMatch('^bar$'), 'Expected "foo" to match "^bar$"')

    expectFail(() => expect('foo').not.toMatch(/^foo$/), 'Expected "foo" not to match /^foo$/')
    expectFail(() => expect('foo').not.toMatch('^foo$'), 'Expected "foo" not to match "^foo$"')
    expectPass(() => expect('foo').not.toMatch(/^bar$/))
    expectPass(() => expect('foo').not.toMatch('^bar$'))

    expectFail(() => expect({}).toMatch(/^.*$/), 'Expected <object> to be a <string>')
    expectFail(() => expect({}).not.toMatch(/^.*$/), 'Expected <object> to be a <string>')
  })

  it('should expect "toStrictlyEqual(...)"', () => {
    const xx = {}

    expectPass(() => expect('').toStrictlyEqual(''))
    expectPass(() => expect(xx).toStrictlyEqual(xx))
    expectFail(() => expect(xx).toStrictlyEqual({}), 'Expected <object> to strictly equal <object>')

    expectFail(() => expect('').not.toStrictlyEqual(''), 'Expected "" not to strictly equal ""')
    expectFail(() => expect(xx).not.toStrictlyEqual(xx), 'Expected <object> not to strictly equal <object>')
    expectPass(() => expect(xx).not.toStrictlyEqual({}))
  })
})