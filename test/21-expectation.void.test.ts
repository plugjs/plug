import { expect } from '../src/expectation/expect'
import { expectPass, expectFail } from './utils'

describe('Void Expectations', () => {
  const positives = {
    toBeDefined: [
      [ '', 'Expected "" not to be defined' ],
      [ false, 'Expected false not to be defined' ],
      [ 0, 'Expected 0 not to be defined' ],
    ],
    toBeFalse: [
      [ false, 'Expected false not to be false' ],
    ],
    toBeFalsy: [
      [ false, 'Expected false not to be falsy' ],
      [ 0, 'Expected 0 not to be falsy' ],
      [ '', 'Expected "" not to be falsy' ],
      [ null, 'Expected <null> not to be falsy' ],
      [ undefined, 'Expected <undefined> not to be falsy' ],
    ],
    toBeNaN: [
      [ NaN, 'Expected <number:NaN> not to be <number:NaN>' ],
    ],
    toBeNegativeInfinity: [
      [ Number.NEGATIVE_INFINITY, 'Expected <number:-Infinity> not to equal <number:-Infinity>' ],
    ],
    toBeNull: [
      [ null, 'Expected <null> not to be <null>' ],
    ],
    toBePositiveInfinity: [
      [ Number.POSITIVE_INFINITY, 'Expected <number:+Infinity> not to equal <number:+Infinity>' ],
    ],
    toBeTrue: [
      [ true, 'Expected true not to be true' ],
    ],
    toBeTruthy: [
      [ true, 'Expected true not to be truthy' ],
      [ 1, 'Expected 1 not to be truthy' ],
      [ 'abc', 'Expected "abc" not to be truthy' ],
    ],
    toBeUndefined: [
      [ undefined, 'Expected <undefined> not to be <undefined>' ],
    ],
  } as const

  describe('matches', () => {
    for (const [ k, values ] of Object.entries(positives)) {
      const key = k as keyof typeof positives
      it(`should expect "${key}()"`, () => {
        for (const [ value ] of values) {
          expectPass(() => expect(value)[key]())
        }
      })
    }
  })

  describe('negated matches', () => {
    for (const [ k, values ] of Object.entries(positives)) {
      const key = k as keyof typeof positives
      it(`should expect "not.${key}()"`, () => {
        for (const [ value, message ] of values) {
          expectFail(() => expect(value).not[key](), message)
        }
      })
    }
  })

  const negatives = {
    toBeDefined: [
      [ null, 'Expected <null> to be defined' ],
      [ undefined, 'Expected <undefined> to be defined' ],
    ],
    toBeFalse: [
      [ true, 'Expected true to be false' ],
      [ 123n, 'Expected 123n to be false' ],
      [ 'xy', 'Expected "xy" to be false' ],
    ],
    toBeFalsy: [
      [ {}, 'Expected <object> to be falsy' ],
      [ Symbol(), 'Expected <symbol> to be falsy' ],
    ],
    toBeNaN: [
      [ 123, 'Expected 123 to be <number:NaN>' ],
      [ 'x', 'Expected "x" to be <number:NaN>' ],
    ],
    toBeNegativeInfinity: [
      [ 123, 'Expected 123 to equal <number:-Infinity>' ],
      [ 'x', 'Expected "x" to equal <number:-Infinity>' ],
    ],
    toBeNull: [
      [ 'foo bar', 'Expected "foo bar" to be <null>' ],
      [ undefined, 'Expected <undefined> to be <null>' ],
    ],
    toBePositiveInfinity: [
      [ 123, 'Expected 123 to equal <number:+Infinity>' ],
      [ 'x', 'Expected "x" to equal <number:+Infinity>' ],
    ],
    toBeTrue: [
      [ false, 'Expected false to be true' ],
      [ 1234n, 'Expected 1234n to be true' ],
      [ 'xyz', 'Expected "xyz" to be true' ],
    ],
    toBeTruthy: [
      [ undefined, 'Expected <undefined> to be truthy' ],
      [ null, 'Expected <null> to be truthy' ],
      [ '', 'Expected "" to be truthy' ],
      [ 0n, 'Expected 0n to be truthy' ],
      [ 0, 'Expected 0 to be truthy' ],
    ],
    toBeUndefined: [
      [ 'xy', 'Expected "xy" to be <undefined>' ],
      [ null, 'Expected <null> to be <undefined>' ],
    ],
  } as const

  describe('mismatches', () => {
    for (const [ k, values ] of Object.entries(negatives)) {
      const key = k as keyof typeof positives
      it(`should expect "${key}()" (negative test)`, () => {
        for (const [ value, message ] of values) {
          expectFail(() => expect(value)[key](), message)
        }
      })
    }
  })

  describe('negated mismatches', () => {
    for (const [ k, values ] of Object.entries(negatives)) {
      const key = k as keyof typeof positives
      it(`should expect "not.${key}()" (negative test)`, () => {
        for (const [ value ] of values) {
          expectPass(() => expect(value).not[key]())
        }
      })
    }
  })
})
