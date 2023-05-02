import { expect, type Expectations, type Matchers } from '@plugjs/expect5'
import { expectError, expectType, printType } from 'tsd'

printType('__file_marker__')

class TestError extends Error {
  test: boolean = true
}

// basic "expect" call test
expectType<string>(expect.toBeA('string').expect(12345))

/* === TO BE A ============================================================== */

expectType<Matchers<string>>(expect.toBeA('string'))
expectType<Matchers<never>>(expect.toBeA('string', expect.toBeA('number')))
expectType<Matchers<string & { length: number }>>(expect.toBeA('string', expect.toHaveLength(12)))
expectType<Matchers<number>>(expect.toBeA('string', (assert) => assert.toBeA('number')))
expectType<Matchers<string>>(expect.toBeA('string', (assert) => {
  expectType<Expectations<string>>(assert)
  assert.toBeA('number') // returns void
}))

/* === TO BE CLOSE TO ======================================================= */

expectType<Matchers<number>>(expect.toBeCloseTo(100, 10))
expectType<Matchers<bigint>>(expect.toBeCloseTo(10n, 1n))
expectError(expect.toBeCloseTo(100, 1n))
expectError(expect.toBeCloseTo(10n, 10))

/* === TO BE DEFINED ======================================================== */

expectType<Matchers<unknown>>(expect.toBeDefined())

/* === TO BE ERROR ========================================================== */

expectType<Matchers<Error>>(expect.toBeError())
expectType<Matchers<Error>>(expect.toBeError('message'))
expectType<Matchers<TestError>>(expect.toBeError(TestError))
expectType<Matchers<TestError>>(expect.toBeError(TestError, 'message'))

/* === TO BE FALSE ========================================================== */

expectType<Matchers<false>>(expect.toBeFalse())

/* === TO BE FALSY ========================================================== */

expectType<Matchers<unknown>>(expect.toBeFalsy())

/* === TO BE GREATER THAN =================================================== */

expectType<Matchers<number>>(expect.toBeGreaterThan(100))
expectType<Matchers<bigint>>(expect.toBeGreaterThan(10n))

/* === TO BE GREATER THAN OR EQUAL ========================================== */

expectType<Matchers<number>>(expect.toBeGreaterThanOrEqual(100))
expectType<Matchers<bigint>>(expect.toBeGreaterThanOrEqual(10n))

/* === TO BE INSTANCE OF ==================================================== */

expectType<Matchers<TestError>>(expect.toBeInstanceOf(TestError))
expectType<Matchers<number>>(expect.toBeInstanceOf(TestError, (assert) => assert.toBeA('number')))
expectType<Matchers<TestError>>(expect.toBeInstanceOf(TestError, (assert) => {
  expectType<Expectations<TestError>>(assert)
  assert.toBeA('number') // returns void
}))

/* === TO BE LESS THAN ====================================================== */

expectType<Matchers<number>>(expect.toBeLessThan(100))
expectType<Matchers<bigint>>(expect.toBeLessThan(10n))

/* === TO BE LESS THAN OR EQUAL ============================================= */

expectType<Matchers<number>>(expect.toBeLessThanOrEqual(100))
expectType<Matchers<bigint>>(expect.toBeLessThanOrEqual(10n))

/* === TO BE NAN ============================================================ */

expectType<Matchers<number>>(expect.toBeNaN())

/* === TO BE NULL =========================================================== */

expectType<Matchers<null>>(expect.toBeNull())

/* === TO BE TRUE =========================================================== */

expectType<Matchers<true>>(expect.toBeTrue())

/* === TO BE TRUTHY ========================================================= */

expectType<Matchers<unknown>>(expect.toBeTruthy())

/* === TO BE UNDEFINED ====================================================== */

expectType<Matchers<undefined>>(expect.toBeUndefined())

/* === TO BE WITHIN RANGE =================================================== */

expectType<Matchers<number>>(expect.toBeWithinRange(100, 10))
expectType<Matchers<bigint>>(expect.toBeWithinRange(10n, 1n))
expectError(expect.toBeWithinRange(100, 1n))
expectError(expect.toBeWithinRange(10n, 10))

/* === TO EQUAL ============================================================= */

expectType<Matchers<123>>(expect.toEqual(123))
expectType<Matchers<unknown>>(expect.toEqual(true as unknown))
expectType<Matchers<number[]>>(expect.toEqual([ 123 ]))
expectType<Matchers<{
  foo: string,
  bar: number,
}>>(expect.toEqual({
  foo: 'hello, world!', // straight type
  bar: expect.toBeA('number'), // matcher
}))

/* === TO HAVE LENGTH ======================================================= */

expectType<Matchers<unknown & { length: number }>>(expect.toHaveLength(123))

/* === TO HAVE PROPERTY ===================================================== */

expect<Matchers<unknown & { prop: unknown }>>(expect.toHaveProperty('prop'))

// with matchers
expect<Matchers<unknown & { prop: number }>>(expect.toHaveProperty('prop', expect.toBeA('number')))
expect<Matchers<unknown & { prop: { foo: string } }>>(expect.toHaveProperty('prop', expect.toEqual({ foo: 'bar' })))

// with assertions
expect<Matchers<unknown & { prop: number }>>(expect.toHaveProperty('prop', (assert) => assert.toBeA('number')))
expect<Matchers<unknown & { prop: undefined }>>(expect.toHaveProperty('prop', (assert) => assert.toBeUndefined()))

// with assertion returning "void"
expect<Matchers<unknown & { prop: unknown }>>(expect.toHaveProperty('prop', (assert) => {
  expectType<Expectations<unknown>>(assert)
  assert.toBeA('number')
}))

/* === TO HAVE SIZE ========================================================= */

expectType<Matchers<unknown & { size: number }>>(expect.toHaveSize(123))

/* === TO INCLUDE =========================================================== */

expectType<Matchers<unknown>>(expect.toInclude({ foo: 'bar' }))
expectType<Matchers<unknown>>(expect.toInclude([ 'foo', 'bar' ]))
expectType<Matchers<unknown>>(expect.toInclude(new Set<string>()))
expectType<Matchers<unknown>>(expect.toInclude(new Map<number, boolean>()))

/* === TO MATCH ============================================================= */

expectType<Matchers<string>>(expect.toMatch('foobar'))
expectType<Matchers<string>>(expect.toMatch(/foobar/))

/* === TO MATCH CONTENTS  =================================================== */

expectType<Matchers<unknown>>(expect.toMatchContents([ 'foo', 'bar' ]))
expectType<Matchers<unknown>>(expect.toMatchContents(new Set<string>()))

/* === TO STRICTLY EQUAL ==================================================== */

expectType<Matchers<123>>(expect.toStrictlyEqual(123))
expectType<Matchers<unknown>>(expect.toStrictlyEqual(true as unknown))
expectType<Matchers<number[]>>(expect.toStrictlyEqual([ 123 ]))
expectType<Matchers<{ foo: string}>>(expect.toStrictlyEqual({ foo: 'bar' }))
