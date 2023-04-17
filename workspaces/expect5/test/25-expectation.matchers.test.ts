import assert from 'node:assert'

import { expect } from '../src/expectation/expect'
import { isMatcher } from '../src/expectation/types'
import { expectFail, expectPass } from './utils'

describe('Expectations Matcher', () => {
  it('should expect with matchers', () => {
    const error = new SyntaxError('Whatever')
    const throwing = (): never => {
      throw error
    }

    expectPass(() => expect.toBeA('string').expect('foo'))
    expectPass(() => expect.toBeCloseTo(100, 10).expect(99))
    expectPass(() => expect.toBeError().expect(new SyntaxError('Foo')))
    expectPass(() => expect.toBeGreaterThan(100).expect(101))
    expectPass(() => expect.toBeGreaterThanOrEqual(100).expect(100))
    expectPass(() => expect.toBeInstanceOf(Error).expect(new SyntaxError('Foo')))
    expectPass(() => expect.toBeLessThan(100).expect(99))
    expectPass(() => expect.toBeLessThanOrEqual(100).expect(100))
    expectPass(() => expect.toBeWithinRange(100, 200).expect(150))
    expectPass(() => expect.toEqual({ a: 'foo' }).expect({ a: 'foo' }))
    expectPass(() => expect.toHaveLength(3).expect('foo'))
    expectPass(() => expect.toHaveProperty('a').expect({ a: 'foo' }))
    expectPass(() => expect.toHaveSize(1).expect(new Set([ 'foo' ])))
    expectPass(() => expect.toMatch(/^foo$/i).expect('FOO'))
    expectPass(() => expect.toStrictlyEqual('foo').expect('foo'))
    expectPass(() => expect.toThrow().expect(throwing))
    expectPass(() => expect.toThrowError(SyntaxError, 'Whatever').expect(throwing))
    expectPass(() => expect.toBeDefined().expect('foo'))
    expectPass(() => expect.toBeFalse().expect(false))
    expectPass(() => expect.toBeFalsy().expect(0))
    expectPass(() => expect.toBeNaN().expect(NaN))
    expectPass(() => expect.toBeNegativeInfinity().expect(-1/0))
    expectPass(() => expect.toBeNull().expect(null))
    expectPass(() => expect.toBePositiveInfinity().expect(1/0))
    expectPass(() => expect.toBeTrue().expect(true))
    expectPass(() => expect.toBeTruthy().expect(1))
    expectPass(() => expect.toBeUndefined().expect(undefined))
    expectPass(() => expect.toInclude([ 'foo' ]).expect([ 'foo', 'bar' ]))
    expectPass(() => expect.toMatchContents([ 'foo', 123 ]).expect([ 123, 'foo' ]))
  })

  it('should expect negatively with matchers', () => {
    expectPass(() => expect.not.toBeA('string').expect(123))
    expectPass(() => expect.not.toBeCloseTo(100, 10).expect(50))
    expectPass(() => expect.not.toBeError(TypeError).expect({}))
    expectPass(() => expect.not.toBeGreaterThan(100).expect(100))
    expectPass(() => expect.not.toBeGreaterThanOrEqual(100).expect(99))
    expectPass(() => expect.not.toBeInstanceOf(TypeError).expect(new SyntaxError('Foo')))
    expectPass(() => expect.not.toBeLessThan(100).expect(100))
    expectPass(() => expect.not.toBeLessThanOrEqual(100).expect(101))
    expectPass(() => expect.not.toBeWithinRange(100, 200).expect(300))
    expectPass(() => expect.not.toEqual({ a: 'foo' }).expect({ b: 'bar' }))
    expectPass(() => expect.not.toHaveLength(0).expect('foo'))
    expectPass(() => expect.not.toHaveProperty('a').expect({ b: 'foo' }))
    expectPass(() => expect.not.toHaveSize(2).expect(new Set([ 'foo' ])))
    expectPass(() => expect.not.toMatch(/^foo$/i).expect('bar'))
    expectPass(() => expect.not.toStrictlyEqual('foo').expect('bar'))
    expectPass(() => expect.not.toThrow().expect(() => void 0))
    expectPass(() => expect.not.toThrowError(SyntaxError, 'Whatever').expect(() => void 0))
    expectPass(() => expect.not.toBeDefined().expect(null))
    expectPass(() => expect.not.toBeFalse().expect(true))
    expectPass(() => expect.not.toBeFalsy().expect(1))
    expectPass(() => expect.not.toBeNaN().expect(123))
    expectPass(() => expect.not.toBeNegativeInfinity().expect(1/0))
    expectPass(() => expect.not.toBeNull().expect(undefined))
    expectPass(() => expect.not.toBePositiveInfinity().expect(-1/0))
    expectPass(() => expect.not.toBeTrue().expect(false))
    expectPass(() => expect.not.toBeTruthy().expect(0))
    expectPass(() => expect.not.toBeUndefined().expect(null))
    expectPass(() => expect.not.toInclude([ 'foo' ]).expect([ 'bar' ]))
    expectPass(() => expect.not.toMatchContents([ 'foo', 123 ]).expect([ 'bar', 456 ]))
  })

  it('should expect failures with matchers', () => {
    expectFail(() => expect.toBeA('string').expect(123), 'Expected 123 to be a <string>')
    expectFail(() => expect.toBeCloseTo(100, 10).expect(50), 'Expected 50 to be within 90...110')
    expectFail(() => expect.toBeError().expect({}), 'Expected [Object] to be an instance of [Error]')
    expectFail(() => expect.toBeGreaterThan(100).expect(100), 'Expected 100 to be greater than 100')
    expectFail(() => expect.toBeGreaterThanOrEqual(100).expect(99), 'Expected 99 to be greater than or equal to 100')
    expectFail(() => expect.toBeInstanceOf(TypeError).expect(new SyntaxError('Foo')), 'Expected [SyntaxError] to be an instance of [TypeError]')
    expectFail(() => expect.toBeLessThan(100).expect(100), 'Expected 100 to be less than 100')
    expectFail(() => expect.toBeLessThanOrEqual(100).expect(101), 'Expected 101 to be less than or equal to 100')
    expectFail(() => expect.toBeWithinRange(100, 200).expect(300), 'Expected 300 to be within 100...200')
    expectFail(() => expect.toEqual({ a: 'foo' }).expect({ b: 'bar' }), 'Expected [Object] to equal [Object]', {
      diff: true,
      value: { b: 'bar' },
      props: {
        a: { diff: true, missing: 'foo' },
        b: { diff: true, extra: 'bar' },
      },
    })
    expectFail(() => expect.toHaveLength(0).expect('foo'), 'Expected "foo" to have length 0')
    expectFail(() => expect.toHaveProperty('a').expect({ b: 'foo' }), 'Expected [Object] to have property "a"')
    expectFail(() => expect.toHaveSize(2).expect(new Set([ 'foo' ])), 'Expected [Set (1)] to have size 2')
    expectFail(() => expect.toMatch(/^foo$/i).expect('bar'), 'Expected "bar" to match /^foo$/i')
    expectFail(() => expect.toStrictlyEqual('foo').expect('bar'), 'Expected "bar" to strictly equal "foo"', {
      diff: true,
      value: 'bar',
      expected: 'foo',
    })
    expectFail(() => expect.toThrow().expect(() => void 0), 'Expected <function> to throw')
    expectFail(() => expect.toThrowError(SyntaxError, 'Whatever').expect(() => void 0), 'Expected <function> to throw')
    expectFail(() => expect.toBeDefined().expect(null), 'Expected <null> to be defined')
    expectFail(() => expect.toBeFalse().expect(true), 'Expected true to be false')
    expectFail(() => expect.toBeFalsy().expect(1), 'Expected 1 to be falsy')
    expectFail(() => expect.toBeNaN().expect(123), 'Expected 123 to be NaN')
    expectFail(() => expect.toBeNegativeInfinity().expect(1/0), 'Expected +Infinity to equal -Infinity')
    expectFail(() => expect.toBeNull().expect(undefined), 'Expected <undefined> to be <null>')
    expectFail(() => expect.toBePositiveInfinity().expect(-1/0), 'Expected -Infinity to equal +Infinity')
    expectFail(() => expect.toBeTrue().expect(false), 'Expected false to be true')
    expectFail(() => expect.toBeTruthy().expect(0), 'Expected 0 to be truthy')
    expectFail(() => expect.toBeUndefined().expect(null), 'Expected <null> to be <undefined>')
    expectFail(() => expect.toInclude([ 'foo' ]).expect([ 'bar' ]), 'Expected [Array (1)] to include 1 value', {
      diff: true,
      value: [ 'bar' ],
      values: [ { diff: true, missing: 'foo' } ],
    })
    expectFail(() => expect.toMatchContents([ 'foo', 123 ]).expect([ 123 ]), 'Expected [Array (1)] to match contents of [Array]', {
      diff: true,
      value: [ 123 ],
      values: [
        { diff: false, value: 123 },
        { diff: true, missing: 'foo' },
      ],
    })
  })

  it('should expect failures negatively with matchers', () => {
    const error = new SyntaxError('Whatever')
    const throwing = (): never => {
      throw error
    }

    expectFail(() => expect.not.toBeA('string').expect('foo'), 'Expected "foo" not to be a <string>')
    expectFail(() => expect.not.toBeCloseTo(100, 10).expect(99), 'Expected 99 not to be within 90...110')
    expectFail(() => expect.not.toBeError().expect(new SyntaxError('Foo')), 'Expected [SyntaxError] not to be an instance of [Error]')
    expectFail(() => expect.not.toBeGreaterThan(100).expect(101), 'Expected 101 not to be greater than 100')
    expectFail(() => expect.not.toBeGreaterThanOrEqual(100).expect(100), 'Expected 100 not to be greater than or equal to 100')
    expectFail(() => expect.not.toBeInstanceOf(Error).expect(new SyntaxError('Foo')), 'Expected [SyntaxError] not to be an instance of [Error]')
    expectFail(() => expect.not.toBeLessThan(100).expect(99), 'Expected 99 not to be less than 100')
    expectFail(() => expect.not.toBeLessThanOrEqual(100).expect(100), 'Expected 100 not to be less than or equal to 100')
    expectFail(() => expect.not.toBeWithinRange(100, 200).expect(150), 'Expected 150 not to be within 100...200')
    expectFail(() => expect.not.toEqual({ a: 'foo' }).expect({ a: 'foo' }), 'Expected [Object] not to equal [Object]', {
      diff: false,
      value: { a: 'foo' },
      props: {
        a: { diff: false, value: 'foo' },
      },
    })
    expectFail(() => expect.not.toHaveLength(3).expect('foo'), 'Expected "foo" not to have length 3')
    expectFail(() => expect.not.toHaveProperty('a').expect({ a: 'foo' }), 'Expected [Object] not to have property "a"')
    expectFail(() => expect.not.toHaveSize(1).expect(new Set([ 'foo' ])), 'Expected [Set (1)] not to have size 1')
    expectFail(() => expect.not.toMatch(/^foo$/i).expect('FOO'), 'Expected "FOO" not to match /^foo$/i')
    expectFail(() => expect.not.toStrictlyEqual('foo').expect('foo'), 'Expected "foo" not to strictly equal "foo"')
    expectFail(() => expect.not.toThrow().expect(throwing), 'Expected <function throwing> not to throw')
    expectFail(() => expect.not.toThrowError(TypeError, 'Whatever').expect(throwing), 'Expected <function throwing> not to throw')
    expectFail(() => expect.not.toBeDefined().expect('foo'), 'Expected "foo" not to be defined')
    expectFail(() => expect.not.toBeFalse().expect(false), 'Expected false not to be false')
    expectFail(() => expect.not.toBeFalsy().expect(0), 'Expected 0 not to be falsy')
    expectFail(() => expect.not.toBeNaN().expect(NaN), 'Expected NaN not to be NaN')
    expectFail(() => expect.not.toBeNegativeInfinity().expect(-1/0), 'Expected -Infinity not to equal -Infinity')
    expectFail(() => expect.not.toBeNull().expect(null), 'Expected <null> not to be <null>')
    expectFail(() => expect.not.toBePositiveInfinity().expect(1/0), 'Expected +Infinity not to equal +Infinity')
    expectFail(() => expect.not.toBeTrue().expect(true), 'Expected true not to be true')
    expectFail(() => expect.not.toBeTruthy().expect(1), 'Expected 1 not to be truthy')
    expectFail(() => expect.not.toBeUndefined().expect(undefined), 'Expected <undefined> not to be <undefined>')
    expectFail(() => expect.not.toInclude([ 'foo' ]).expect([ 'foo' ]), 'Expected [Array (1)] not to include 1 value', {
      diff: true,
      value: [ 'foo' ],
      values: [ { diff: true, extra: 'foo' } ],
    })
    expectFail(() => expect.not.toMatchContents([ 'foo', 123 ]).expect([ 123, 'foo' ]), 'Expected [Array (2)] not to match contents of [Array]', {
      diff: false,
      value: [ 123, 'foo' ],
      values: [
        { diff: false, value: 123 },
        { diff: false, value: 'foo' },
      ],
    })
  })

  it('should expect matchers in chains', () => {
    expectPass(() => expect
        .toBeA('number')
        .not.toBeGreaterThan(250)
        .toBeLessThanOrEqual(200)
        .expect(100))
    expectFail(() => expect
        .toBeA('string') // fail
        .not.toBeGreaterThan(250)
        .toBeLessThanOrEqual(200)
        .expect(100), 'Expected 100 to be a <string>')
    expectFail(() => expect
        .toBeA('number')
        .not.toBeGreaterThan(250) // fail
        .toBeLessThanOrEqual(200)
        .expect(300), 'Expected 300 not to be greater than 250')
    expectFail(() => expect
        .toBeA('number')
        .not.toBeGreaterThan(250)
        .toBeLessThanOrEqual(200) // fail
        .expect(210), 'Expected 210 to be less than or equal to 200')
  })

  it('should allow extension of matcher chains', () => {
    const base = expect.toBeA('number')
    const first = base.toBeGreaterThan(200)
    const second = base.toBeLessThan(200)

    expectPass(() => base.expect(200))
    expectPass(() => first.expect(201))
    expectPass(() => second.expect(199))

    expectFail(() => first.expect(200), 'Expected 200 to be greater than 200')
    expectFail(() => second.expect(200), 'Expected 200 to be less than 200')
  })

  it('should return itself when double-negating', () => {
    const positive1 = expect.toBeA('number')
    const negative1 = positive1.not
    assert.strictEqual(negative1.not, positive1)
    assert.strictEqual(negative1.not.not, negative1)

    const negative2 = expect.not.toBeA('number')
    const positive2 = negative2.not
    assert.strictEqual(positive2.not, negative2)
    assert.strictEqual(positive2.not.not, positive2)
  })

  it('should be recognized as a matcher', () => {
    const positive1 = expect.toBeA('number')
    const negative1 = positive1.not
    assert.strictEqual(isMatcher(positive1), true)
    assert.strictEqual(isMatcher(negative1), true)
    assert.strictEqual(isMatcher(negative1.not), true)

    const negative2 = expect.not.toBeA('number')
    const positive2 = negative2.not
    assert.strictEqual(isMatcher(negative2), true)
    assert.strictEqual(isMatcher(positive2), true)
    assert.strictEqual(isMatcher(positive2.not), true)
  })

  it('should work with matchers in "toEqual(...)"', () => {
    expectPass(() => expect(100).toEqual(expect.toBeA('number').toBeLessThan(200)))
    expectPass(() => expect({ foo: 100 }).toEqual({
      foo: expect.toBeA('number').toBeLessThan(200),
    }))

    expectFail(() => expect('foo').toEqual(expect.toBeA('number').toBeLessThan(200)),
        'Expected "foo" to equal <matcher>', {
          diff: true,
          value: 'foo',
          error: 'Expected "foo" to be a <number>',
        },
    )

    // nested error
    expectFail(() => expect({ foo: 300 }).toEqual({
      foo: expect.toBeA('number').toBeLessThan(200),
    }), 'Expected [Object] to equal [Object]', {
      diff: true,
      value: { foo: 300 },
      props: {
        foo: {
          diff: true,
          value: 300,
          error: 'Expected 300 to be less than 200',
        },
      },
    })

    // nested diff
    expectFail(() => expect({ foo: { bar: 300 } }).toEqual({
      foo: expect.toEqual({ bar: 'baz' }),
    }), 'Expected [Object] to equal [Object]', {
      diff: true,
      value: { foo: { bar: 300 } },
      props: {
        foo: {
          diff: true,
          value: { bar: 300 },
          props: {
            bar: { diff: true, value: 300, expected: 'baz' },
          },
        },
      },
    })

    // nested diff with different error
    expectFail(() => expect({ foo: { bar: 300 } }).toEqual({
      foo: expect.toBeA('number'),
    }), 'Expected [Object] to equal [Object]', {
      diff: true,
      value: { foo: { bar: 300 } },
      props: {
        foo: {
          diff: true,
          error: 'Expected [Object] to be a <number>',
          value: { bar: 300 },
        },
      },
    })

    // nested matchers and "toHaveProperty" combined
    expectFail(() => expect({ foo: { bar: 300 } }).toEqual({
      foo: expect.toHaveProperty('bar', (assert) => {
        assert.toStrictlyEqual(200)
      }),
    }), 'Expected [Object] to equal [Object]', {
      diff: true,
      value: { foo: { bar: 300 } },
      props: {
        foo: {
          diff: true,
          value: { bar: 300 },
          props: {
            bar: { diff: true, value: 300, expected: 200 },
          },
        },
      },
    })

    // non-expectation error
    assert.throws(() => expect({ foo: { bar: 300 } }).toEqual({
      foo: expect.toHaveProperty('bar', () => {
        throw new SyntaxError('Whoha, bessie!')
      }),
    }), (error) => {
      assert(error instanceof SyntaxError, 'Error type')
      assert.strictEqual(error.message, 'Whoha, bessie!', 'Error message')
      return true
    })
  })
})
