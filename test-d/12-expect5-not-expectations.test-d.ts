import { expect, type Expectations } from '@plugjs/expect5'
import { expectError, expectType, printType } from 'tsd'

printType('__file_marker__')

type TestType = boolean & { __test: never }
const expectations = expect(true as TestType)
class TestError extends Error {
  test: boolean = true
}

/* === TO BE A ============================================================== */

expectType<Expectations<TestType>>(expectations.not.toBeA('string'))

/* === TO BE CLOSE TO ======================================================= */

expectType<Expectations<number>>(expectations.not.toBeCloseTo(100, 10))
expectType<Expectations<bigint>>(expectations.not.toBeCloseTo(10n, 1n))
expectError(expectations.not.toBeCloseTo(100, 1n))
expectError(expectations.not.toBeCloseTo(10n, 10))

/* === TO BE DEFINED ======================================================== */

expectType<Expectations<null | undefined>>(expectations.not.toBeDefined())

/* === TO BE INSTANCE OF ==================================================== */

expectType<Expectations<TestType>>(expectations.not.toBeInstanceOf(TestError))

/* === TO BE NAN ============================================================ */

expectType<Expectations<number>>(expectations.not.toBeNaN())

/* === TO BE WITHIN RANGE =================================================== */

expectType<Expectations<number>>(expectations.not.toBeWithinRange(100, 10))
expectType<Expectations<bigint>>(expectations.not.toBeWithinRange(10n, 1n))
expectError(expectations.not.toBeWithinRange(100, 1n))
expectError(expectations.not.toBeWithinRange(10n, 10))

/* === TO EQUAL ============================================================= */

expectType<Expectations<TestType>>(expectations.not.toEqual(123))
expectType<Expectations<TestType>>(expectations.not.toEqual(true as unknown))
expectType<Expectations<TestType>>(expectations.not.toEqual([ 123 ]))
expectType<Expectations<TestType>>(expectations.not.toEqual({
  foo: 'hello, world!', // straight type
  bar: expect.toBeA('number'), // matcher
}))

/* === TO HAVE LENGTH ======================================================= */

expectType<Expectations<TestType & { length: number }>>(expectations.not.toHaveLength(123))

/* === TO HAVE PROPERTY ===================================================== */

expect<Expectations<TestType>>(expectations.not.toHaveProperty('prop'))

/* === TO HAVE SIZE ========================================================= */

expectType<Expectations<TestType & { size: number }>>(expectations.not.toHaveSize(123))

/* === TO INCLUDE =========================================================== */

expectType<Expectations<TestType>>(expectations.not.toInclude({ foo: 'bar' }))
expectType<Expectations<TestType>>(expectations.not.toInclude([ 'foo', 'bar' ]))
expectType<Expectations<TestType>>(expectations.not.toInclude(new Set<string>()))
expectType<Expectations<TestType>>(expectations.not.toInclude(new Map<number, boolean>()))

/* === TO MATCH ============================================================= */

expectType<Expectations<string>>(expectations.not.toMatch('foobar'))
expectType<Expectations<string>>(expectations.not.toMatch(/foobar/))

/* === TO STRICTLY EQUAL ==================================================== */

expectType<Expectations<TestType>>(expectations.not.toStrictlyEqual(123))
expectType<Expectations<TestType>>(expectations.not.toStrictlyEqual(true as unknown))
expectType<Expectations<TestType>>(expectations.not.toStrictlyEqual([ 123 ]))
expectType<Expectations<TestType>>(expectations.not.toStrictlyEqual({ foo: 'bar' }))

/* === TO THROW ============================================================= */

expectType<Expectations<() => any>>(expectations.not.toThrow())
