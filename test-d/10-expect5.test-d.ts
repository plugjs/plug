import { printType, expectType, expectError } from 'tsd'
import { type Expectations, expect } from '@plugjs/expect5'

import type { ExpectationsMatcher, AssertionFunction } from '@plugjs/expect5/expectation/expect'
import type { Constructor, TypeName } from '@plugjs/expect5/expectation/types'

printType('__file_marker__')

// straight expectations
expectType<Expectations<any>>(expect('' as any))
expectType<Expectations<unknown>>(expect('' as unknown))

expectType<Expectations<string>>(expect('foobar'))
expectType<Expectations<number>>(expect(12345678))
expectType<Expectations<RegExp>>(expect(/foobar/))
expectType<Expectations<SyntaxError>>(expect(new SyntaxError()))

// values of Expectations
expectType<string>(expect('foobar').value)
expectType<number>(expect(12345678).value)
expectType<RegExp>(expect(/foobar/).value)
expectType<SyntaxError>(expect(new SyntaxError()).value)

// basic expectations
expectType<Expectations<string>>(expect(123).toBeA('string'))
expectType<Expectations<number>>(expect(123).toBeA('number'))
expectError<Expectations<number>>(expect(123).toBeA('string'))
expectError<Expectations<string>>(expect(123).toBeA('number'))
expectError(expect(123).toBeA('foobar'))

expectType<Expectations<number>>(expect(true).toBeCloseTo(100, 1))
expectType<Expectations<bigint>>(expect(true).toBeCloseTo(100n, 1n))
expectError<Expectations<string>>(expect(true).toBeCloseTo(100, 1))
expectError(expect(true).toBeCloseTo(100n, 1))
expectError(expect(true).toBeCloseTo(100, 1n))

expectType<Expectations<Error>>(expect(true).toBeError())
expectType<Expectations<Error>>(expect(true).toBeError('message'))
expectType<Expectations<TypeError>>(expect(true).toBeError(TypeError))
expectType<Expectations<TypeError>>(expect(true).toBeError(TypeError, 'message'))
expectError<Expectations<RegExp>>(expect(true).toBeError())
expectError(expect(true).toBeError(RegExp))

expectType<Expectations<number>>(expect(true).toBeGreaterThan(100))
expectType<Expectations<bigint>>(expect(true).toBeGreaterThan(100n))
expectError<Expectations<string>>(expect(true).toBeGreaterThan(100))
expectError(expect(true).toBeGreaterThan('foo'))

expectType<Expectations<number>>(expect(true).toBeGreaterThanOrEqual(100))
expectType<Expectations<bigint>>(expect(true).toBeGreaterThanOrEqual(100n))
expectError<Expectations<string>>(expect(true).toBeGreaterThanOrEqual(100))
expectError(expect(true).toBeGreaterThanOrEqual('foo'))

expectType<Expectations<RegExp>>(expect(true).toBeInstanceOf(RegExp))
expectError<Expectations<Error>>(expect(true).toBeInstanceOf(RegExp))
expectError(expect(true).toBeInstanceOf({}))

expectType<Expectations<number>>(expect(true).toBeLessThan(100))
expectType<Expectations<bigint>>(expect(true).toBeLessThan(100n))
expectError<Expectations<string>>(expect(true).toBeLessThan(100))
expectError(expect(true).toBeLessThan('foo'))

expectType<Expectations<number>>(expect(true).toBeLessThanOrEqual(100))
expectType<Expectations<bigint>>(expect(true).toBeLessThanOrEqual(100n))
expectError<Expectations<string>>(expect(true).toBeLessThanOrEqual(100))
expectError(expect(true).toBeLessThanOrEqual('foo'))

expectType<Expectations<number>>(expect(true).toBeWithinRange(100, 1))
expectType<Expectations<bigint>>(expect(true).toBeWithinRange(100n, 1n))
expectError<Expectations<string>>(expect(true).toBeWithinRange(100, 1))
expectError(expect(true).toBeWithinRange(100n, 1))
expectError(expect(true).toBeWithinRange(100, 1n))

expectType<Expectations<string>>(expect(true).toEqual('foobar'))
expectType<Expectations<{ foo: string }>>(expect(true).toEqual({ foo: 'bar' }))
expectError<Expectations<string>>(expect(true).toEqual(12345678))
expectError<Expectations<{ foo: string }>>(expect(true).toEqual({ foo: 1234 }))

expectType<Expectations<boolean & { length: 12 }>>(expect(true).toHaveLength(12))
expectError<Expectations<boolean & { length: 0 }>>(expect(true).toHaveLength(12))
expectError(expect(true).toHaveLength('foo'))

expectType<Expectations<boolean & { foo: unknown }>>(expect(true).toHaveProperty('foo'))
expectType<Expectations<boolean & { foo: string }>>(expect(true).toHaveProperty('foo', (assert) => assert.toBeA('string')))
expectType<Expectations<boolean & { foo: unknown }>>(expect(true).toHaveProperty('foo', (assert) => void assert.toBeA('string')))
expectError<Expectations<boolean & { bar: unknown }>>(expect(true).toHaveProperty('foo').value)
expectError<Expectations<boolean & { foo: number }>>(expect(true).toHaveProperty('foo', (assert) => assert.toBeA('string')))
expectError(expect(true).toHaveProperty({}))

expectType<Expectations<boolean & { size: 12 }>>(expect(true).toHaveSize(12))
expectError<Expectations<boolean & { size: 0 }>>(expect(true).toHaveSize(12))
expectError(expect(true).toHaveSize('foo'))

expectType<Expectations<string>>(expect(true).toMatch('foo'))
expectType<Expectations<string>>(expect(true).toMatch(/foo/))
expectError<Expectations<number>>(expect(true).toMatch('foo'))
expectError(expect(true).toMatch(true))

expectType<Expectations<string>>(expect(true).toStrictlyEqual('foobar'))
expectType<Expectations<{ foo: string }>>(expect(true).toStrictlyEqual({ foo: 'bar' }))
expectError<Expectations<string>>(expect(true).toStrictlyEqual(12345678))
expectError<Expectations<{ foo: string }>>(expect(true).toStrictlyEqual({ foo: 1234 }))

// async expectations
expectType<Promise<Expectations<Promise<unknown>>>>(expect('foo').toBeResolved())
expectType<Promise<Expectations<Promise<string>>>>(expect('foo').toBeResolved((assert) => assert.toBeA('string')))
expectType<Promise<Expectations<Promise<unknown>>>>(expect('foo').toBeResolved((assert) => void assert.toBeA('string')))


// TODO: negated expectations
// expectType<Promise<Expectations<Promise<unknown>>>>(expect('foo').toBeResolved((assert) => assert.not.toBeA('string')))

/* === EXPECTATIONS MATCHERS ================================================ */

expectType<{(...args:
| [TypeName]
| [TypeName, AssertionFunction ]
): ExpectationsMatcher}>(expect.toBeA)

expectType<{(...args:
| [number, number]
| [bigint, bigint ]
): ExpectationsMatcher}>(expect.toBeCloseTo)

expectType<{(...args:
| []
| [string]
| [RegExp]
| [Constructor<Error>]
| [Constructor<Error>, string]
| [Constructor<Error>, RegExp]
): ExpectationsMatcher}>(expect.toBeError)

expectType<{(...args:
| [number]
| [bigint]
): ExpectationsMatcher}>(expect.toBeGreaterThan)

expectType<{(...args:
| [number]
| [bigint]
): ExpectationsMatcher}>(expect.toBeGreaterThanOrEqual)

expectType<{(...args:
| [Constructor]
): ExpectationsMatcher}>(expect.toBeInstanceOf)

expectType<{(...args:
| [number]
| [bigint]
): ExpectationsMatcher}>(expect.toBeLessThan)

expectType<{(...args:
| [number]
| [bigint]
): ExpectationsMatcher}>(expect.toBeLessThanOrEqual)

expectType<{(...args:
| [number, number]
| [bigint, bigint ]
): ExpectationsMatcher}>(expect.toBeWithinRange)

expectType<{(...args:
| [unknown] // generic...
): ExpectationsMatcher}>(expect.toEqual)

expectType<{(...args:
| [number]
): ExpectationsMatcher}>(expect.toHaveLength)

expectType<{(...args:
| [string | symbol | number]
| [string | symbol | number, AssertionFunction ]
): ExpectationsMatcher}>(expect.toHaveProperty)

expectType<{(...args:
| [number]
): ExpectationsMatcher}>(expect.toHaveSize)

expectType<{(...args:
| [string]
| [RegExp]
): ExpectationsMatcher}>(expect.toMatch)
