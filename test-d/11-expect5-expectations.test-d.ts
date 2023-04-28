import { expect, type AsyncExpectations, type Expectations } from '@plugjs/expect5'
import { expectError, expectType, printType } from 'tsd'

printType('__file_marker__')

type TestType = boolean & { __test: never }
const expectations = expect(true as TestType)
class TestError extends Error {
  test: boolean = true
}

expectType<AsyncExpectations<TestType>>(expectations)
expectType<TestType>(expectations.value)

/* === TO BE A ============================================================== */

expectType<Expectations<string>>(expectations.toBeA('string'))
expectType<Expectations<number>>(expectations.toBeA('string', (assert) => assert.toBeA('number')))
expectType<Expectations<string>>(expectations.toBeA('string', (assert) => {
  expectType<Expectations<string>>(assert)
  assert.toBeA('number') // returns void
}))

/* === TO BE CLOSE TO ======================================================= */

expectType<Expectations<number>>(expectations.toBeCloseTo(100, 10))
expectType<Expectations<bigint>>(expectations.toBeCloseTo(10n, 1n))
expectError(expectations.toBeCloseTo(100, 1n))
expectError(expectations.toBeCloseTo(10n, 10))

/* === TO BE DEFINED ======================================================== */

expectType<Expectations<TestType>>(expectations.toBeDefined())

/* === TO BE ERROR ========================================================== */

expectType<Expectations<Error>>(expectations.toBeError())
expectType<Expectations<Error>>(expectations.toBeError('message'))
expectType<Expectations<TestError>>(expectations.toBeError(TestError))
expectType<Expectations<TestError>>(expectations.toBeError(TestError, 'message'))

/* === TO BE FALSE ========================================================== */

expectType<Expectations<false>>(expectations.toBeFalse())

/* === TO BE FALSY ========================================================== */

expectType<Expectations<TestType>>(expectations.toBeFalsy())

/* === TO BE GREATER THAN =================================================== */

expectType<Expectations<number>>(expectations.toBeGreaterThan(100))
expectType<Expectations<bigint>>(expectations.toBeGreaterThan(10n))

/* === TO BE GREATER THAN OR EQUAL ========================================== */

expectType<Expectations<number>>(expectations.toBeGreaterThanOrEqual(100))
expectType<Expectations<bigint>>(expectations.toBeGreaterThanOrEqual(10n))

/* === TO BE INSTANCE OF ==================================================== */

expectType<Expectations<TestError>>(expectations.toBeInstanceOf(TestError))
expectType<Expectations<number>>(expectations.toBeInstanceOf(TestError, (assert) => assert.toBeA('number')))
expectType<Expectations<TestError>>(expectations.toBeInstanceOf(TestError, (assert) => {
  expectType<Expectations<TestError>>(assert)
  assert.toBeA('number') // returns void
}))

/* === TO BE LESS THAN ====================================================== */

expectType<Expectations<number>>(expectations.toBeLessThan(100))
expectType<Expectations<bigint>>(expectations.toBeLessThan(10n))

/* === TO BE LESS THAN OR EQUAL ============================================= */

expectType<Expectations<number>>(expectations.toBeLessThanOrEqual(100))
expectType<Expectations<bigint>>(expectations.toBeLessThanOrEqual(10n))

/* === TO BE NAN ============================================================ */

expectType<Expectations<number>>(expectations.toBeNaN())

/* === TO BE NULL =========================================================== */

expectType<Expectations<null>>(expectations.toBeNull())

/* === TO BE TRUE =========================================================== */

expectType<Expectations<true>>(expectations.toBeTrue())

/* === TO BE TRUTHY ========================================================= */

expectType<Expectations<TestType>>(expectations.toBeTruthy())

/* === TO BE UNDEFINED ====================================================== */

expectType<Expectations<undefined>>(expectations.toBeUndefined())

/* === TO BE WITHIN RANGE =================================================== */

expectType<Expectations<number>>(expectations.toBeWithinRange(100, 10))
expectType<Expectations<bigint>>(expectations.toBeWithinRange(10n, 1n))
expectError(expectations.toBeWithinRange(100, 1n))
expectError(expectations.toBeWithinRange(10n, 10))

/* === TO EQUAL ============================================================= */

expectType<Expectations<123>>(expectations.toEqual(123))
expectType<Expectations<unknown>>(expectations.toEqual(true as unknown))
expectType<Expectations<number[]>>(expectations.toEqual([ 123 ]))
expectType<Expectations<{
  foo: string,
  bar: number,
}>>(expectations.toEqual({
  foo: 'hello, world!', // straight type
  bar: expect.toBeA('number'), // matcher
}))

/* === TO HAVE LENGTH ======================================================= */

expectType<Expectations<TestType & { length: number }>>(expectations.toHaveLength(123))

/* === TO HAVE PROPERTY ===================================================== */

expect<Expectations<TestType & { prop: unknown }>>(expectations.toHaveProperty('prop'))
expect<Expectations<TestType & { prop: number }>>(expectations.toHaveProperty('prop', (assert) => assert.toBeA('number')))
expect<Expectations<TestType & { prop: undefined }>>(expectations.toHaveProperty('prop', (assert) => assert.toBeUndefined()))
expect<Expectations<TestType & { prop: unknown }>>(expectations.toHaveProperty('prop', (assert) => {
  expectType<Expectations<unknown>>(assert)
  assert.toBeA('number')
}))

/* === TO HAVE SIZE ========================================================= */

expectType<Expectations<TestType & { size: number }>>(expectations.toHaveSize(123))

/* === TO INCLUDE =========================================================== */

expectType<Expectations<TestType>>(expectations.toInclude({ foo: 'bar' }))
expectType<Expectations<TestType>>(expectations.toInclude([ 'foo', 'bar' ]))
expectType<Expectations<TestType>>(expectations.toInclude(new Set<string>()))
expectType<Expectations<TestType>>(expectations.toInclude(new Map<number, boolean>()))

/* === TO MATCH ============================================================= */

expectType<Expectations<string>>(expectations.toMatch('foobar'))
expectType<Expectations<string>>(expectations.toMatch(/foobar/))

/* === TO MATCH CONTENTS  =================================================== */

expectType<Expectations<TestType>>(expectations.toMatchContents([ 'foo', 'bar' ]))
expectType<Expectations<TestType>>(expectations.toMatchContents(new Set<string>()))

/* === TO STRICTLY EQUAL ==================================================== */

expectType<Expectations<123>>(expectations.toStrictlyEqual(123))
expectType<Expectations<unknown>>(expectations.toStrictlyEqual(true as unknown))
expectType<Expectations<number[]>>(expectations.toStrictlyEqual([ 123 ]))
expectType<Expectations<{ foo: string}>>(expectations.toStrictlyEqual({ foo: 'bar' }))

/* === TO THROW ============================================================= */

expectType<Expectations<() => any>>(expectations.toThrow())
expectType<Expectations<() => any>>(expectations.toThrow((assert) => assert.toBeA('string')))
expectType<Expectations<() => any>>(expectations.toThrow((assert) => {
  expectType<Expectations<unknown>>(assert)
  assert.toBeA('string')
}))

/* === TO THROW ERROR ======================================================= */

expectType<Expectations<() => any>>(expectations.toThrowError())
expectType<Expectations<() => any>>(expectations.toThrowError('message'))
expectType<Expectations<() => any>>(expectations.toThrowError(TestError))
expectType<Expectations<() => any>>(expectations.toThrowError(TestError, 'message'))
