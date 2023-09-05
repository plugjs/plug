import { expect } from '@plugjs/expect5'
import { expectError, expectType, printType } from 'tsd'

import type { Matchers } from '@plugjs/expect5'

printType('__file_marker__')

class TestError extends Error {
  test: boolean = true
}

// basic "expect.not" call test
expectType<unknown>(expect.not.toBeA('string').expect(12345))
expectType<string>(expect.not.toMatch('string').expect(12345))

/* === TO BE A ============================================================== */

expectType<Matchers<unknown>>(expect.not.toBeA('string'))

/* === TO BE CLOSE TO ======================================================= */

expectType<Matchers<number>>(expect.not.toBeCloseTo(100, 10))
expectType<Matchers<bigint>>(expect.not.toBeCloseTo(10n, 1n))
expectError(expect.not.toBeCloseTo(100, 1n))
expectError(expect.not.toBeCloseTo(10n, 10))

/* === TO BE DEFINED ======================================================== */

expectType<Matchers<null | undefined>>(expect.not.toBeDefined())

/* === TO BE INSTANCE OF ==================================================== */

expectType<Matchers<unknown>>(expect.not.toBeInstanceOf(TestError))

/* === TO BE NAN ============================================================ */

expectType<Matchers<number>>(expect.not.toBeNaN())

/* === TO BE WITHIN RANGE =================================================== */

expectType<Matchers<number>>(expect.not.toBeWithinRange(100, 10))
expectType<Matchers<bigint>>(expect.not.toBeWithinRange(10n, 1n))
expectError(expect.not.toBeWithinRange(100, 1n))
expectError(expect.not.toBeWithinRange(10n, 10))

/* === TO EQUAL ============================================================= */

expectType<Matchers<unknown>>(expect.not.toEqual(123))
expectType<Matchers<unknown>>(expect.not.toEqual(true as unknown))
expectType<Matchers<unknown>>(expect.not.toEqual([ 123 ]))
expectType<Matchers<unknown>>(expect.not.toEqual({
  foo: 'hello, world!', // straight type
  bar: expect.toBeA('number'), // matcher
}))

/* === TO HAVE LENGTH ======================================================= */

expectType<Matchers<unknown & { length: number }>>(expect.not.toHaveLength(123))

/* === TO HAVE PROPERTY ===================================================== */

expect<Matchers<unknown>>(expect.not.toHaveProperty('prop'))

/* === TO HAVE SIZE ========================================================= */

expectType<Matchers<unknown & { size: number }>>(expect.not.toHaveSize(123))

/* === TO INCLUDE =========================================================== */

expectType<Matchers<unknown>>(expect.not.toInclude({ foo: 'bar' }))
expectType<Matchers<unknown>>(expect.not.toInclude([ 'foo', 'bar' ]))
expectType<Matchers<unknown>>(expect.not.toInclude(new Set<string>()))
expectType<Matchers<unknown>>(expect.not.toInclude(new Map<number, boolean>()))

/* === TO MATCH ============================================================= */

expectType<Matchers<string>>(expect.not.toMatch('foobar'))
expectType<Matchers<string>>(expect.not.toMatch(/foobar/))

/* === TO STRICTLY EQUAL ==================================================== */

expectType<Matchers<unknown>>(expect.not.toStrictlyEqual(123))
expectType<Matchers<unknown>>(expect.not.toStrictlyEqual(true as unknown))
expectType<Matchers<unknown>>(expect.not.toStrictlyEqual([ 123 ]))
expectType<Matchers<unknown>>(expect.not.toStrictlyEqual({ foo: 'bar' }))
