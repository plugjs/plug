import assert from 'node:assert'

import { expect } from '../src/expectation/expect'
import { expectFail, expectPass } from './utils'

describe('Basic Expectations', () => {
  it('should expect "toBeA(...)"', () => {
    expectPass(() => expect('foo').toBeA('string'))
    expectPass(() => expect('foo').toBeA('string', expect.toStrictlyEqual('foo')))
    expectPass(() => expect('foo').toBeA('string', (assert) => assert.toStrictlyEqual('foo')))
    expectPass(() => expect(new Date()).toBeA('date'))

    expectFail(() => expect('foo').toBeA('date'), 'Expected "foo" to be a <date>')
    expectFail(() => expect('foo').toBeA('number'), 'Expected "foo" to be a <number>')
    expectFail(() => expect('foo').toBeA('string', expect.toStrictlyEqual('bar')),
        'Expected "foo" to strictly equal "bar"', {
          diff: true,
          value: 'foo',
          expected: 'bar',
        })
    expectFail(() => expect('foo').toBeA('string', (assert) => assert.toStrictlyEqual('bar')),
        'Expected "foo" to strictly equal "bar"', {
          diff: true,
          value: 'foo',
          expected: 'bar',
        })

    expectPass(() => expect('foo').not.toBeA('number'))
    expectFail(() => expect('foo').not.toBeA('string'), 'Expected "foo" not to be a <string>')
  })

  it('should expect "toBeAfter(...)"', () => {
    expectPass(() => expect(1).toBeAfter(0))
    expectPass(() => expect(new Date(1)).toBeAfter(new Date(0)))
    expectPass(() => expect('1970-01-01T00:00:00.001Z').toBeAfter('1970-01-01T00:00:00.000Z'))

    expectFail(() => expect({}).toBeAfter(0), 'Expected [Object] to be a string, a number or an instance of [Date]')
    expectFail(() => expect('nope').toBeAfter(0), 'Expected "nope" to be a valid date')

    expectFail(() => expect(0).toBeAfter(0), 'Expected 0 to be after [Date: 1970-01-01T00:00:00.000Z]')
    expectFail(() => expect(0).toBeAfter(1), 'Expected 0 to be after [Date: 1970-01-01T00:00:00.001Z]')
    expectFail(() => expect(new Date(0)).toBeAfter(new Date(0)), 'Expected [Date: 1970-01-01T00:00:00.000Z] to be after [Date: 1970-01-01T00:00:00.000Z]')
    expectFail(() => expect(new Date(0)).toBeAfter(new Date(1)), 'Expected [Date: 1970-01-01T00:00:00.000Z] to be after [Date: 1970-01-01T00:00:00.001Z]')
    expectFail(() => expect('1970-01-01T00:00:00.000Z').toBeAfter('1970-01-01T00:00:00.000Z'), 'Expected "1970-01-01T00:00:00.000Z" to be after [Date: 1970-01-01T00:00:00.000Z]')
    expectFail(() => expect('1970-01-01T00:00:00.000Z').toBeAfter('1970-01-01T00:00:00.001Z'), 'Expected "1970-01-01T00:00:00.000Z" to be after [Date: 1970-01-01T00:00:00.001Z]')

    expectPass(() => expect(1001).toBeAfter(1000, 1))
    expectFail(() => expect(1002).toBeAfter(1000, 1), 'Expected 1002 to be before [Date: 1970-01-01T00:00:01.002Z]')
  })

  it('should expect "toBeAfterOrEqual(...)"', () => {
    expectPass(() => expect(0).toBeAfterOrEqual(0))
    expectPass(() => expect(new Date(0)).toBeAfterOrEqual(new Date(0)))
    expectPass(() => expect('1970-01-01T00:00:00.000Z').toBeAfterOrEqual('1970-01-01T00:00:00.000Z'))

    expectFail(() => expect(0).toBeAfterOrEqual(1), 'Expected 0 to be after [Date: 1970-01-01T00:00:00.000Z]')
    expectFail(() => expect(new Date(0)).toBeAfterOrEqual(new Date(1)), 'Expected [Date: 1970-01-01T00:00:00.000Z] to be after [Date: 1970-01-01T00:00:00.000Z]')
    expectFail(() => expect('1970-01-01T00:00:00.000Z').toBeAfterOrEqual('1970-01-01T00:00:00.001Z'), 'Expected "1970-01-01T00:00:00.000Z" to be after [Date: 1970-01-01T00:00:00.000Z]')

    expectPass(() => expect(1001).toBeAfterOrEqual(1001, 1))
    expectPass(() => expect(1002).toBeAfterOrEqual(1001, 1))
    expectFail(() => expect(1003).toBeAfterOrEqual(1001, 1), 'Expected 1003 to be before [Date: 1970-01-01T00:00:01.003Z]')
  })

  it('should expect "toBeBefore(...)"', () => {
    expectPass(() => expect(0).toBeBefore(1))
    expectPass(() => expect(new Date(0)).toBeBefore(new Date(1)))
    expectPass(() => expect('1970-01-01T00:00:00.000Z').toBeBefore('1970-01-01T00:00:00.001Z'))

    expectFail(() => expect({}).toBeBefore(0), 'Expected [Object] to be a string, a number or an instance of [Date]')
    expectFail(() => expect('nope').toBeBefore(0), 'Expected "nope" to be a valid date')

    expectFail(() => expect(1).toBeBefore(0), 'Expected 1 to be before [Date: 1970-01-01T00:00:00.000Z]')
    expectFail(() => expect(0).toBeBefore(0), 'Expected 0 to be before [Date: 1970-01-01T00:00:00.000Z]')
    expectFail(() => expect(new Date(1)).toBeBefore(new Date(0)), 'Expected [Date: 1970-01-01T00:00:00.001Z] to be before [Date: 1970-01-01T00:00:00.000Z]')
    expectFail(() => expect(new Date(0)).toBeBefore(new Date(0)), 'Expected [Date: 1970-01-01T00:00:00.000Z] to be before [Date: 1970-01-01T00:00:00.000Z]')
    expectFail(() => expect('1970-01-01T00:00:00.001Z').toBeBefore('1970-01-01T00:00:00.000Z'), 'Expected "1970-01-01T00:00:00.001Z" to be before [Date: 1970-01-01T00:00:00.000Z]')
    expectFail(() => expect('1970-01-01T00:00:00.000Z').toBeBefore('1970-01-01T00:00:00.000Z'), 'Expected "1970-01-01T00:00:00.000Z" to be before [Date: 1970-01-01T00:00:00.000Z]')

    expectPass(() => expect(1001).toBeBefore(1002, 1))
    expectFail(() => expect(1000).toBeBefore(1002, 1), 'Expected 1000 to be after [Date: 1970-01-01T00:00:01.000Z]')
  })

  it('should expect "toBeBeforeOrEqual(...)"', () => {
    expectPass(() => expect(0).toBeBeforeOrEqual(0))
    expectPass(() => expect(new Date(0)).toBeBeforeOrEqual(new Date(0)))
    expectPass(() => expect('1970-01-01T00:00:00.000Z').toBeBeforeOrEqual('1970-01-01T00:00:00.000Z'))

    expectFail(() => expect(1).toBeBeforeOrEqual(0), 'Expected 1 to be before [Date: 1970-01-01T00:00:00.001Z]')
    expectFail(() => expect(new Date(1)).toBeBeforeOrEqual(new Date(0)), 'Expected [Date: 1970-01-01T00:00:00.001Z] to be before [Date: 1970-01-01T00:00:00.001Z]')
    expectFail(() => expect('1970-01-01T00:00:00.001Z').toBeBeforeOrEqual('1970-01-01T00:00:00.000Z'), 'Expected "1970-01-01T00:00:00.001Z" to be before [Date: 1970-01-01T00:00:00.001Z]')

    expectPass(() => expect(1003).toBeBeforeOrEqual(1003, 1))
    expectPass(() => expect(1002).toBeBeforeOrEqual(1003, 1))
    expectFail(() => expect(1001).toBeBeforeOrEqual(1003, 1), 'Expected 1001 to be after [Date: 1970-01-01T00:00:01.001Z]')
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

    expectFail(() => expect('foo').toBeError(), 'Expected "foo" to be an instance of [Error]')
    expectFail(() => expect(error).toBeError('Bar!'), 'Expected property ["message"] of [SyntaxError] ("Foo!") to strictly equal "Bar!"', {
      diff: true,
      value: error,
      props: {
        message: {
          diff: true,
          value: 'Foo!',
          expected: 'Bar!',
        },
      },
    })
    expectFail(() => expect(error).toBeError(/bar/i), 'Expected property ["message"] of [SyntaxError] ("Foo!") to match /bar/i')
    expectFail(() => expect(error).toBeError(TypeError), 'Expected [SyntaxError] to be an instance of [TypeError]')
    expectFail(() => expect({ message: 123 }).toBeError(Object as any, '123'), 'Expected property ["message"] of [Object] (123) to be a <string>')
  })

  it('should expect "toBeGreaterThan(...)"', () => {
    expectPass(() => expect(3).toBeGreaterThan(2))
    expectPass(() => expect(3n).toBeGreaterThan(2n))

    expectFail(() => expect(3).toBeGreaterThan(3), 'Expected 3 to be greater than 3')
    expectFail(() => expect(3n).toBeGreaterThan(3n), 'Expected 3n to be greater than 3n')

    expectFail(() => expect(3n).toBeGreaterThan(2), 'Expected 3n to be a <number>')
    expectFail(() => expect(3).toBeGreaterThan(2n), 'Expected 3 to be a <bigint>')
  })

  it('should expect "toBeGreaterThanOrEqual(...)"', () => {
    expectPass(() => expect(3).toBeGreaterThanOrEqual(3))
    expectPass(() => expect(3n).toBeGreaterThanOrEqual(3n))

    expectFail(() => expect(2).toBeGreaterThanOrEqual(3), 'Expected 2 to be greater than or equal to 3')
    expectFail(() => expect(2n).toBeGreaterThanOrEqual(3n), 'Expected 2n to be greater than or equal to 3n')

    expectFail(() => expect(3n).toBeGreaterThanOrEqual(3), 'Expected 3n to be a <number>')
    expectFail(() => expect(3).toBeGreaterThanOrEqual(3n), 'Expected 3 to be a <bigint>')
  })

  it('should expect "toBeInstanceOf(...)"', () => {
    const error = new TypeError('some message')

    expectPass(() => expect(error).toBeInstanceOf(Error))
    expectPass(() => expect(error).toBeInstanceOf(TypeError))
    expectPass(() => expect(error).toBeInstanceOf(TypeError, expect.toHaveProperty('message', expect.toStrictlyEqual('some message'))))
    expectPass(() => expect(error).toBeInstanceOf(TypeError, (assert) => assert.toHaveProperty('message', expect.toStrictlyEqual('some message'))))

    expectFail(() => expect(error).toBeInstanceOf(SyntaxError), 'Expected [TypeError] to be an instance of [SyntaxError]')
    expectFail(() => expect(error).toBeInstanceOf(TypeError, expect.toHaveProperty('message', expect.toStrictlyEqual('a different message'))),
        'Expected property ["message"] of [TypeError] ("some message") to strictly equal "a different message"', {
          diff: true,
          value: error,
          props: {
            message: {
              diff: true,
              value: 'some message',
              expected: 'a different message',
            },
          },
        })
    expectFail(() => expect(error).toBeInstanceOf(TypeError, (assert) => assert.toHaveProperty('message', expect.toStrictlyEqual('a different message'))),
        'Expected property ["message"] of [TypeError] ("some message") to strictly equal "a different message"', {
          diff: true,
          value: error,
          props: {
            message: {
              diff: true,
              value: 'some message',
              expected: 'a different message',
            },
          },
        })

    expectFail(() => expect(error).not.toBeInstanceOf(Error), 'Expected [TypeError] not to be an instance of [Error]')
    expectFail(() => expect(error).not.toBeInstanceOf(TypeError), 'Expected [TypeError] not to be an instance of [TypeError]')
    expectPass(() => expect(error).not.toBeInstanceOf(SyntaxError))
  })

  it('should expect "toBeLessThan(...)"', () => {
    expectPass(() => expect(2).toBeLessThan(3))
    expectPass(() => expect(2n).toBeLessThan(3n))

    expectFail(() => expect(3).toBeLessThan(3), 'Expected 3 to be less than 3')
    expectFail(() => expect(3n).toBeLessThan(3n), 'Expected 3n to be less than 3n')

    expectFail(() => expect(2n).toBeLessThan(3), 'Expected 2n to be a <number>')
    expectFail(() => expect(2).toBeLessThan(3n), 'Expected 2 to be a <bigint>')
  })

  it('should expect "toBeLessThanOrEqual(...)"', () => {
    expectPass(() => expect(3).toBeLessThanOrEqual(3))
    expectPass(() => expect(3n).toBeLessThanOrEqual(3n))

    expectFail(() => expect(3).toBeLessThanOrEqual(2), 'Expected 3 to be less than or equal to 2')
    expectFail(() => expect(3n).toBeLessThanOrEqual(2n), 'Expected 3n to be less than or equal to 2n')

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

  it('should expect "toEqual(...)"', () => {
    expectPass(() => expect('foo').toEqual('foo'))
    expectPass(() => expect({ foo: 'bar' }).toEqual({ foo: 'bar' }))
    expectPass(() => expect([ 'foo', 'bar' ]).toEqual([ 'foo', 'bar' ]))
    expectPass(() => expect({
      foo: undefined,
      bar: 'foobar',
    }).toEqual({
      // foo: undefined, // implicit (no key) so ignore it!
      bar: 'foobar',
    }))

    expectPass(() => expect({
      foo: undefined,
      bar: 'foobar',
    }).toEqual({
      foo: undefined,
      bar: 'foobar',
    }, true))

    expectPass(() => expect('foo').not.toEqual('bar'))
    expectPass(() => expect({ foo: 'bar' }).not.toEqual({ foo: 'baz' }))
    expectPass(() => expect([ 'foo', 'bar' ]).not.toEqual([ 'foo', 'baz' ]))

    expectFail(() => expect('foo').not.toEqual('foo'), 'Expected "foo" not to equal "foo"', {
      diff: false,
      value: 'foo',
    })
    expectFail(() => expect({ foo: 'bar' }).not.toEqual({ foo: 'bar' }), 'Expected [Object] not to equal [Object]', {
      diff: false,
      value: { foo: 'bar' },
      props: {
        foo: { diff: false, value: 'bar' },
      },
    })
    expectFail(() => expect([ 'foo', 'bar' ]).not.toEqual([ 'foo', 'bar' ]), 'Expected [Array (2)] not to equal [Array (2)]', {
      diff: false,
      value: [ 'foo', 'bar' ],
      values: [
        { diff: false, value: 'foo' },
        { diff: false, value: 'bar' },
      ],
    })

    expectFail(() => expect('foo').toEqual('bar'), 'Expected "foo" to equal "bar"', {
      diff: true,
      value: 'foo',
      expected: 'bar',
    })

    expectFail(() => expect({
      bar: 'foobar',
    }).toEqual({
      foo: undefined, // explicit (has key), so must be defined!
      bar: 'foobar',
    }), 'Expected [Object] to equal [Object]', {
      diff: true,
      value: { bar: 'foobar' },
      props: {
        bar: { diff: false, value: 'foobar' },
        foo: { diff: true, missing: undefined },
      },
    })

    expectFail(() => expect({
      foo: undefined, // explicit (has key), so must be defined in strict mode!
      bar: 'foobar',
    }).toEqual({
      bar: 'foobar',
    }, true), 'Expected [Object] to equal [Object]', {
      diff: true,
      value: {
        foo: undefined,
        bar: 'foobar',
      },
      props: {
        bar: { diff: false, value: 'foobar' },
        foo: { diff: true, extra: undefined },
      },
    })

    expectFail(() => expect({ foo: 'bar' }).toEqual({ foo: 'baz' }), 'Expected [Object] to equal [Object]', {
      diff: true,
      value: { foo: 'bar' },
      props: {
        foo: {
          diff: true,
          value: 'bar',
          expected: 'baz',
        },
      },
    })

    expectFail(() => expect([ 'foo', 'bar' ]).toEqual([ 'foo', 'baz' ]), 'Expected [Array (2)] to equal [Array (2)]', {
      diff: true,
      value: [ 'foo', 'bar' ],
      values: [
        { diff: false, value: 'foo' },
        { diff: true, value: 'bar', expected: 'baz' },
      ],
    })

    // arrays with different order
    expectFail(() => expect([ 'foo', 'bar' ]).toEqual([ 'bar', 'foo' ]), 'Expected [Array (2)] to equal [Array (2)]', {
      diff: true,
      value: [ 'foo', 'bar' ],
      values: [
        { diff: true, value: 'foo', expected: 'bar' },
        { diff: true, value: 'bar', expected: 'foo' },
      ],
    })
  })

  it('should expect "toHaveProperty(...)"', () => {
    const s = Symbol()
    const s2 = Symbol()

    expectPass(() => expect('foo').toHaveProperty('length'))
    expectPass(() => expect('foo').toHaveProperty('length', expect.toStrictlyEqual(3)))
    expectPass(() => expect('foo').toHaveProperty('length', (assert) => assert.toEqual(3)))
    expectPass(() => expect([ 0 ]).toHaveProperty(0))
    expectPass(() => expect({ [s]: 'foo' }).toHaveProperty(s))

    expectFail(() => expect('foo').not.toHaveProperty('length'), 'Expected "foo" not to have property "length"')
    expectFail(() => expect([ 0 ]).not.toHaveProperty(0), 'Expected [Array (1)] not to have property "0"')
    expectFail(() => expect({ [s]: 'foo' }).not.toHaveProperty(s), 'Expected [Object] not to have property "Symbol()"')

    expectFail(() => expect('foo').toHaveProperty('length', (assert) => assert.toEqual(0)), 'Expected property ["length"] of "foo" (3) to equal 0', {
      diff: true,
      value: 'foo',
      props: { length: { diff: true, value: 3, expected: 0 } },
    })
    expectFail(() => expect('foo').toHaveProperty('bar'), 'Expected "foo" to have property "bar"')
    expectFail(() => expect([ 0 ]).toHaveProperty(1), 'Expected [Array (1)] to have property "1"')
    expectFail(() => expect({ [s]: 'foo' }).toHaveProperty(s2), 'Expected [Object] to have property "Symbol()"')

    expectPass(() => expect('foo').not.toHaveProperty('bar'))
    expectPass(() => expect([ 0 ]).not.toHaveProperty(1))
    expectPass(() => expect({ [s]: 'foo' }).not.toHaveProperty(s2))

    const object = { foo: { bar: 'baz' } }
    let value: any = undefined
    expectPass(() => expect(object).toHaveProperty('foo', (assert) => void (value = assert.value)))
    assert.strictEqual(value, object.foo)
  })

  it('should expect "toHaveLength(...)"', () => {
    expectPass(() => expect('foo').toHaveLength(3))
    expectPass(() => expect('').toHaveLength(0))
    expectPass(() => expect([]).toHaveLength(0))
    expectPass(() => expect({ length: 123 }).toHaveLength(123))

    expectFail(() => expect('foo').toHaveLength(9), 'Expected "foo" to have length 9')
    expectFail(() => expect('').toHaveLength(9), 'Expected "" to have length 9')
    expectFail(() => expect([]).toHaveLength(9), 'Expected [Array (0)] to have length 9')
    expectFail(() => expect({ length: 123 }).toHaveLength(9), 'Expected [Object] to have length 9')

    expectFail(() => expect('foo').not.toHaveLength(3), 'Expected "foo" not to have length 3')
    expectFail(() => expect('').not.toHaveLength(0), 'Expected "" not to have length 0')
    expectFail(() => expect([]).not.toHaveLength(0), 'Expected [Array (0)] not to have length 0')
    expectFail(() => expect({ length: 123 }).not.toHaveLength(123), 'Expected [Object] not to have length 123')

    expectPass(() => expect('foo').not.toHaveLength(9))
    expectPass(() => expect('').not.toHaveLength(9))
    expectPass(() => expect([]).not.toHaveLength(9))
    expectPass(() => expect({ length: 123 }).not.toHaveLength(9))

    expectFail(() => expect(null).toHaveLength(123), 'Expected <null> to be neither <null> nor <undefined>')
    expectFail(() => expect(null).not.toHaveLength(123), 'Expected <null> to be neither <null> nor <undefined>')
    expectFail(() => expect(undefined).toHaveLength(123), 'Expected <undefined> to be neither <null> nor <undefined>')
    expectFail(() => expect(undefined).not.toHaveLength(123), 'Expected <undefined> to be neither <null> nor <undefined>')

    expectFail(() => expect({}).toHaveLength(123), 'Expected [Object] to have a numeric "length" property')
    expectFail(() => expect({}).not.toHaveLength(123), 'Expected [Object] to have a numeric "length" property')
    expectFail(() => expect({ length: 'foo' }).toHaveLength(123), 'Expected [Object] to have a numeric "length" property')
    expectFail(() => expect({ length: 'foo' }).not.toHaveLength(123), 'Expected [Object] to have a numeric "length" property')
  })

  it('should expect "toHaveSize(...)"', () => {
    expectPass(() => expect(new Set([ 'foo' ])).toHaveSize(1))
    expectPass(() => expect(new Map([ [ 'foo', 'bar' ] ])).toHaveSize(1))
    expectPass(() => expect({ size: 123 }).toHaveSize(123))

    expectFail(() => expect(new Set([ 'foo' ])).toHaveSize(9), 'Expected [Set (1)] to have size 9')
    expectFail(() => expect(new Map([ [ 'foo', 'bar' ] ])).toHaveSize(9), 'Expected [Map (1)] to have size 9')
    expectFail(() => expect({ size: 123 }).toHaveSize(9), 'Expected [Object] to have size 9')

    expectFail(() => expect(new Set([ 'foo' ])).not.toHaveSize(1), 'Expected [Set (1)] not to have size 1')
    expectFail(() => expect(new Map([ [ 'foo', 'bar' ] ])).not.toHaveSize(1), 'Expected [Map (1)] not to have size 1')
    expectFail(() => expect({ size: 123 }).not.toHaveSize(123), 'Expected [Object] not to have size 123')

    expectPass(() => expect(new Set([ 'foo' ])).not.toHaveSize(9))
    expectPass(() => expect(new Map([ [ 'foo', 'bar' ] ])).not.toHaveSize(9))
    expectPass(() => expect({ size: 123 }).not.toHaveSize(9))

    expectFail(() => expect(null).toHaveSize(123), 'Expected <null> to be neither <null> nor <undefined>')
    expectFail(() => expect(null).not.toHaveSize(123), 'Expected <null> to be neither <null> nor <undefined>')
    expectFail(() => expect(undefined).toHaveSize(123), 'Expected <undefined> to be neither <null> nor <undefined>')
    expectFail(() => expect(undefined).not.toHaveSize(123), 'Expected <undefined> to be neither <null> nor <undefined>')

    expectFail(() => expect({}).toHaveSize(123), 'Expected [Object] to have a numeric "size" property')
    expectFail(() => expect({}).not.toHaveSize(123), 'Expected [Object] to have a numeric "size" property')
    expectFail(() => expect({ size: 'foo' }).toHaveSize(123), 'Expected [Object] to have a numeric "size" property')
    expectFail(() => expect({ size: 'foo' }).not.toHaveSize(123), 'Expected [Object] to have a numeric "size" property')
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

    expectFail(() => expect({}).toMatch(/^.*$/), 'Expected [Object] to be a <string>')
    expectFail(() => expect({}).not.toMatch(/^.*$/), 'Expected [Object] to be a <string>')
  })

  it('should expect "toStrictlyEqual(...)" / "toBe(...)"', () => {
    const xx = {}

    expectPass(() => expect('').toStrictlyEqual(''))
    expectPass(() => expect(xx).toStrictlyEqual(xx))
    expectFail(() => expect(xx).toStrictlyEqual({}), 'Expected [Object] to strictly equal [Object]', {
      diff: true,
      value: xx,
      expected: {},
    })

    expectFail(() => expect('').not.toStrictlyEqual(''), 'Expected "" not to strictly equal ""')
    expectFail(() => expect(xx).not.toStrictlyEqual(xx), 'Expected [Object] not to strictly equal [Object]')
    expectPass(() => expect(xx).not.toStrictlyEqual({}))
  })
})
