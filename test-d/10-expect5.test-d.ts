import { expect, type Expectations } from '@plugjs/expect5'
import { expectError, expectType, printType } from 'tsd'

import type { Matchers } from '@plugjs/expect5/expectation/expect'
import type { AssertionFunction, Constructor, TypeName } from '@plugjs/expect5/expectation/types'

printType('__file_marker__')

/* === CORE ================================================================= */

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

/* === ASYNC EXPECTATIONS =================================================== */

expectType<Promise<Expectations<PromiseLike<string>>>>(expect('foo').toBeResolved())
expectType<Promise<Expectations<PromiseLike<string>>>>(expect(Promise.resolve('foo')).toBeResolved())
expectType<Promise<Expectations<PromiseLike<unknown>>>>(expect(true as unknown).toBeResolved())
expectType<Promise<Expectations<PromiseLike<number>>>>(expect(true as unknown).toBeResolved((assert) => assert.toBeA('number')))
expectType<Promise<Expectations<PromiseLike<number>>>>(expect(true).toBeResolved((assert) => assert.toBeA('number')))

expectType<Promise<Expectations<PromiseLike<string>>>>(expect('foo').not.toBeResolved()) // negative is _also_ a promise!

expectType<Promise<Expectations<PromiseLike<string>>>>(expect('foo').toBeRejected())
expectType<Promise<Expectations<PromiseLike<string>>>>(expect('foo').toBeRejected((assert) => assert.toBeA('number')))
expectType<Promise<Expectations<PromiseLike<unknown>>>>(expect('foo' as unknown).toBeRejected((assert) => assert.toBeA('number')))

expectType<Promise<Expectations<PromiseLike<string>>>>(expect('foo').not.toBeRejectedWithError())
expectType<Promise<Expectations<PromiseLike<string>>>>(expect('foo').not.toBeRejectedWithError())

/* === BASIC EXPECTATIONS =================================================== */

expectType<Expectations<string>>(expect(123).toBeA('string'))
expectType<Expectations<number>>(expect(123).toBeA('number'))
expectError<Expectations<number>>(expect(123).toBeA('string'))
expectError<Expectations<string>>(expect(123).toBeA('number'))
expectError(expect(123).toBeA('foobar'))

expectType<Expectations<boolean>>(expect(true).not.toBeA('string'))

expectType<Expectations<number>>(expect(true).toBeCloseTo(100, 1))
expectType<Expectations<bigint>>(expect(true).toBeCloseTo(100n, 1n))
expectError<Expectations<string>>(expect(true).toBeCloseTo(100, 1))
expectError(expect(true).toBeCloseTo(100n, 1))
expectError(expect(true).toBeCloseTo(100, 1n))

expectType<Expectations<boolean>>(expect(true).not.toBeCloseTo(100, 1))

expectType<Expectations<Error>>(expect(true).toBeError())
expectType<Expectations<Error>>(expect(true).toBeError('message'))
expectType<Expectations<TypeError>>(expect(true).toBeError(TypeError))
expectType<Expectations<TypeError>>(expect(true).toBeError(TypeError, 'message'))
expectError<Expectations<RegExp>>(expect(true).toBeError())
expectError(expect(true).toBeError(RegExp))

expectType<Expectations<boolean>>(expect(true).not.toBeError())

expectType<Expectations<number>>(expect(true).toBeGreaterThan(100))
expectType<Expectations<bigint>>(expect(true).toBeGreaterThan(100n))
expectError<Expectations<string>>(expect(true).toBeGreaterThan(100))
expectError(expect(true).toBeGreaterThan('foo'))

expectType<Expectations<boolean>>(expect(true).not.toBeGreaterThan(100))

expectType<Expectations<number>>(expect(true).toBeGreaterThanOrEqual(100))
expectType<Expectations<bigint>>(expect(true).toBeGreaterThanOrEqual(100n))
expectError<Expectations<string>>(expect(true).toBeGreaterThanOrEqual(100))
expectError(expect(true).toBeGreaterThanOrEqual('foo'))

expectType<Expectations<boolean>>(expect(true).not.toBeGreaterThanOrEqual(100))

expectType<Expectations<RegExp>>(expect(true).toBeInstanceOf(RegExp))
expectError<Expectations<Error>>(expect(true).toBeInstanceOf(RegExp))
expectError(expect(true).toBeInstanceOf({}))

expectType<Expectations<boolean>>(expect(true).not.toBeInstanceOf(RegExp))

expectType<Expectations<number>>(expect(true).toBeLessThan(100))
expectType<Expectations<bigint>>(expect(true).toBeLessThan(100n))
expectError<Expectations<string>>(expect(true).toBeLessThan(100))
expectError(expect(true).toBeLessThan('foo'))

expectType<Expectations<boolean>>(expect(true).not.toBeLessThan(100))

expectType<Expectations<number>>(expect(true).toBeLessThanOrEqual(100))
expectType<Expectations<bigint>>(expect(true).toBeLessThanOrEqual(100n))
expectError<Expectations<string>>(expect(true).toBeLessThanOrEqual(100))
expectError(expect(true).toBeLessThanOrEqual('foo'))

expectType<Expectations<boolean>>(expect(true).not.toBeLessThanOrEqual(100))

expectType<Expectations<number>>(expect(true).toBeWithinRange(100, 1))
expectType<Expectations<bigint>>(expect(true).toBeWithinRange(100n, 1n))
expectError<Expectations<string>>(expect(true).toBeWithinRange(100, 1))
expectError(expect(true).toBeWithinRange(100n, 1))
expectError(expect(true).toBeWithinRange(100, 1n))

expectType<Expectations<boolean>>(expect(true).not.toBeWithinRange(100, 1))

expectType<Expectations<string>>(expect(true).toEqual('foobar'))
expectType<Expectations<{ foo: string }>>(expect(true).toEqual({ foo: 'bar' }))
expectError<Expectations<string>>(expect(true).toEqual(12345678))
expectError<Expectations<{ foo: string }>>(expect(true).toEqual({ foo: 1234 }))

expectType<Expectations<boolean>>(expect(true).not.toEqual(100))

expectType<Expectations<boolean & { length: 12 }>>(expect(true).toHaveLength(12))
expectError<Expectations<boolean & { length: 0 }>>(expect(true).toHaveLength(12))
expectError(expect(true).toHaveLength('foo'))

expectType<Expectations<boolean>>(expect(true).not.toHaveLength(100))

expectType<Expectations<boolean & { foo: unknown }>>(expect(true).toHaveProperty('foo'))
expectType<Expectations<boolean & { foo: string }>>(expect(true).toHaveProperty('foo', (assert) => assert.toBeA('string')))
expectType<Expectations<boolean & { foo: unknown }>>(expect(true).toHaveProperty('foo', (assert) => void assert.toBeA('string')))
expectError<Expectations<boolean & { bar: unknown }>>(expect(true).toHaveProperty('foo').value)
expectError<Expectations<boolean & { foo: number }>>(expect(true).toHaveProperty('foo', (assert) => assert.toBeA('string')))
expectError(expect(true).toHaveProperty({}))

expectType<Expectations<boolean>>(expect(true).not.toHaveProperty(100))

expectType<Expectations<boolean & { size: 12 }>>(expect(true).toHaveSize(12))
expectError<Expectations<boolean & { size: 0 }>>(expect(true).toHaveSize(12))
expectError(expect(true).toHaveSize('foo'))

expectType<Expectations<boolean>>(expect(true).not.toHaveSize(100))

expectType<Expectations<string>>(expect(true).toMatch('foo'))
expectType<Expectations<string>>(expect(true).toMatch(/foo/))
expectError<Expectations<number>>(expect(true).toMatch('foo'))
expectError(expect(true).toMatch(true))

expectType<Expectations<boolean>>(expect(true).not.toMatch(/foo/))

expectType<Expectations<string>>(expect(true).toStrictlyEqual('foobar'))
expectType<Expectations<{ foo: string }>>(expect(true).toStrictlyEqual({ foo: 'bar' }))
expectError<Expectations<string>>(expect(true).toStrictlyEqual(12345678))
expectError<Expectations<{ foo: string }>>(expect(true).toStrictlyEqual({ foo: 1234 }))

expectType<Expectations<boolean>>(expect(true).not.toStrictlyEqual('foobar'))

/* === INCLUDE EXPECTATIONS ================================================= */

// we can not infer any extra type in "include" as plain objects can be used
// to check for mappings in maps, and sets/arrays boil down to an iterable

expectType<Expectations<boolean>>(expect(true).toInclude({ foo: 'bar', bar: 123 }))
expectType<Expectations<boolean>>(expect(true).toInclude(new Map<string, number>()))
expectType<Expectations<boolean>>(expect(true).toInclude(new Set<RegExp>()))
expectType<Expectations<boolean>>(expect(true).toInclude([ 1, 2, 3 ]))
expectError(expect(true).toInclude(true))

expectType<Expectations<boolean>>(expect(true).not.toInclude([]))

expectType<Expectations<boolean>>(expect(true).toMatchContents(new Set<any>()))
expectType<Expectations<boolean>>(expect(true).toMatchContents([]))
expectError(expect(true).toMatchContents(true))

expectType<Expectations<boolean>>(expect(true).not.toMatchContents([]))


/* === THROWING EXPECTATIONS ================================================ */

expectType<Expectations<boolean & Function>>(expect(true).toThrow())
expectType<Expectations<boolean & Function>>(expect(true).toThrow((assert) => assert.toBeA('string')))
expectError(expect(true).toThrow('foobar'))

expectType<Expectations<boolean>>(expect(true).not.toThrow())

expectType<Expectations<boolean & Function>>(expect(true).toThrowError())
expectType<Expectations<boolean & Function>>(expect(true).toThrowError('message'))
expectType<Expectations<boolean & Function>>(expect(true).toThrowError(/message/))
expectType<Expectations<boolean & Function>>(expect(true).toThrowError(SyntaxError))
expectType<Expectations<boolean & Function>>(expect(true).toThrowError(SyntaxError, 'message'))
expectType<Expectations<boolean & Function>>(expect(true).toThrowError(SyntaxError, /message/))
expectError(expect(true).toThrowError(Object))

expectType<Expectations<boolean>>(expect(true).not.toThrowError())

/* === TRIVIAL EXPECTATIONS ================================================= */

expectType<Expectations<unknown>>(expect(true as unknown).toBeDefined())
expectType<Expectations<false>>(expect(true as unknown).toBeFalse())
expectType<Expectations<unknown>>(expect(true as unknown).toBeFalsy())
expectType<Expectations<number>>(expect(true as unknown).toBeNaN())
expectType<Expectations<number>>(expect(true as unknown).toBeNegativeInfinity())
expectType<Expectations<null>>(expect(true as unknown).toBeNull())
expectType<Expectations<null | undefined>>(expect(true as unknown).toBeNullable())
expectType<Expectations<number>>(expect(true as unknown).toBePositiveInfinity())
expectType<Expectations<true>>(expect(true as unknown).toBeTrue())
expectType<Expectations<unknown>>(expect(true as unknown).toBeTruthy())
expectType<Expectations<undefined>>(expect(true as unknown).toBeUndefined())

expectType<Expectations<boolean>>(expect(true).not.toBeDefined())
expectType<Expectations<boolean>>(expect(true).not.toBeFalse())
expectType<Expectations<boolean>>(expect(true).not.toBeFalsy())
expectType<Expectations<boolean>>(expect(true).not.toBeNaN())
expectType<Expectations<boolean>>(expect(true).not.toBeNegativeInfinity())
expectType<Expectations<boolean>>(expect(true).not.toBeNull())
expectType<Expectations<boolean>>(expect(true).not.toBeNullable())
expectType<Expectations<boolean>>(expect(true).not.toBePositiveInfinity())
expectType<Expectations<boolean>>(expect(true).not.toBeTrue())
expectType<Expectations<boolean>>(expect(true).not.toBeTruthy())
expectType<Expectations<boolean>>(expect(true).not.toBeUndefined())

/* === EXPECTATIONS MATCHERS (CONSTRUCTOR OVERLOADS) ======================== */

// basic expectations

expectType<{(...args:
| [TypeName]
| [TypeName, AssertionFunction ]
): Matchers}>(expect.toBeA)

expectType<{(...args:
| [number, number]
| [bigint, bigint ]
): Matchers}>(expect.toBeCloseTo)

expectType<{(...args:
| []
| [string]
| [RegExp]
| [Constructor<Error>]
| [Constructor<Error>, string]
| [Constructor<Error>, RegExp]
): Matchers}>(expect.toBeError)

expectType<{(...args:
| [number]
| [bigint]
): Matchers}>(expect.toBeGreaterThan)

expectType<{(...args:
| [number]
| [bigint]
): Matchers}>(expect.toBeGreaterThanOrEqual)

expectType<{(...args:
| [Constructor]
): Matchers}>(expect.toBeInstanceOf)

expectType<{(...args:
| [number]
| [bigint]
): Matchers}>(expect.toBeLessThan)

expectType<{(...args:
| [number]
| [bigint]
): Matchers}>(expect.toBeLessThanOrEqual)

expectType<{(...args:
| [number, number]
| [bigint, bigint ]
): Matchers}>(expect.toBeWithinRange)

expectType<{(...args:
| [unknown] // generic...
): Matchers}>(expect.toEqual)

expectType<{(...args:
| [number]
): Matchers}>(expect.toHaveLength)

expectType<{(...args:
| [string | symbol | number]
| [string | symbol | number, AssertionFunction ]
): Matchers}>(expect.toHaveProperty)

expectType<{(...args:
| [number]
): Matchers}>(expect.toHaveSize)

expectType<{(...args:
| [string]
| [RegExp]
): Matchers}>(expect.toMatch)

expectType<{(...args:
| [unknown] // any becomes unknown, as it's generic
): Matchers}>(expect.toStrictlyEqual)

// include expectations

expectType<{(...args:
| [any[]]
| [Record<string, any>]
| [Map<any, any>]
| [Set<any>]
): Matchers}>(expect.toInclude)

expectType<{(...args:
| [Set<any>]
| [any[]]
): Matchers}>(expect.toMatchContents)

// throwing expectations

expectType<{(...args:
| []
| [AssertionFunction]
): Matchers}>(expect.toThrow)

expectType<{(...args:
| []
| [string]
| [RegExp]
| [Constructor<Error>]
| [Constructor<Error>, string]
| [Constructor<Error>, RegExp]
): Matchers}>(expect.toThrowError)

// trivial expectations

expectType<{(...args: []): Matchers}>(expect.toBeDefined)
expectType<{(...args: []): Matchers}>(expect.toBeFalse)
expectType<{(...args: []): Matchers}>(expect.toBeFalsy)
expectType<{(...args: []): Matchers}>(expect.toBeNaN)
expectType<{(...args: []): Matchers}>(expect.toBeNegativeInfinity)
expectType<{(...args: []): Matchers}>(expect.toBeNull)
expectType<{(...args: []): Matchers}>(expect.toBeNullable)
expectType<{(...args: []): Matchers}>(expect.toBePositiveInfinity)
expectType<{(...args: []): Matchers}>(expect.toBeTrue)
expectType<{(...args: []): Matchers}>(expect.toBeTruthy)
expectType<{(...args: []): Matchers}>(expect.toBeUndefined)

/* === KEYS ================================================================= */

type asyncKeys =
| 'toBeResolved'
| 'toBeRejected'
| 'toBeRejectedWithError'

type basicKeys =
| 'toBeA'
| 'toBeCloseTo'
| 'toBeError'
| 'toBeGreaterThan'
| 'toBeGreaterThanOrEqual'
| 'toBeInstanceOf'
| 'toBeLessThan'
| 'toBeLessThanOrEqual'
| 'toBeWithinRange'
| 'toEqual'
| 'toHaveLength'
| 'toHaveProperty'
| 'toHaveSize'
| 'toMatch'
| 'toStrictlyEqual'

type includeKeys =
| 'toInclude'
| 'toMatchContents'

type throwingKeys =
| 'toThrow'
| 'toThrowError'

type trivialKeys =
| 'toBeDefined'
| 'toBeFalse'
| 'toBeFalsy'
| 'toBeNaN'
| 'toBeNegativeInfinity'
| 'toBeNull'
| 'toBeNullable'
| 'toBePositiveInfinity'
| 'toBeTrue'
| 'toBeTruthy'
| 'toBeUndefined'


const expectations = expect(true)

// Expectations
expectType<
| asyncKeys
| basicKeys
| includeKeys
| throwingKeys
| trivialKeys
// expectations specific
| 'value'
| 'not'
>(null as any as keyof typeof expectations)

// ExpectationFunctions
expectType<
| asyncKeys
| basicKeys
| includeKeys
| throwingKeys
| trivialKeys
>(null as any as keyof typeof expectations.not)

// Matchers
expectType<
// no async!
| basicKeys
| includeKeys
| throwingKeys
| trivialKeys
// matchers specific
| 'expect'
| 'not'
>(null as any as keyof typeof expect)
