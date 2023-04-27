import { expect } from '../src/expectation/expect'
import { expectPass, expectFail } from './utils'

fdescribe('Trivial Expectations', () => {
  const positivePassing = {
    toBeDefined: [ '', false, 0 ],
    toBeFalse: [ false ],
    toBeFalsy: [ false, 0, '', null, undefined ],
    toBeNaN: [ NaN ],
    toBeNull: [ null ],
    toBeTrue: [ true ],
    toBeTruthy: [ true, 1, 'abc', {} ],
    toBeUndefined: [ undefined ],
  } as const

  const negativePassing = {
    toBeDefined: [ null, undefined ],
    toBeNaN: [ 123 ],
  } as const

  describe('passing', () => {
    for (const [ k, values ] of Object.entries(positivePassing)) {
      const key = k as keyof typeof positivePassing
      it(`should expect "${key}()"`, () => {
        for (const value of values) {
          expectPass(() => expect(value)[key]())
        }
      })
    }

    for (const [ k, values ] of Object.entries(negativePassing)) {
      const key = k as keyof typeof negativePassing
      it(`should expect "not.${key}()"`, () => {
        for (const value of values) {
          expectPass(() => expect(value).not[key]())
        }
      })
    }
  })

  const positiveFailing= {
    toBeDefined: [
      { message: 'Expected <null> to be neither <null> nor <undefined>', value: null },
      { message: 'Expected <undefined> to be neither <null> nor <undefined>', value: undefined },
    ],
    toBeFalse: [
      { message: 'Expected true to strictly equal false', value: true, diff: { expected: false } },
      { message: 'Expected "xy" to strictly equal false', value: 'xy', diff: { expected: false } },
    ],
    toBeFalsy: [
      { message: 'Expected true to be falsy', value: true },
      { message: 'Expected 1234 to be falsy', value: 1234 },
      { message: 'Expected "xy" to be falsy', value: 'xy' },
      { message: 'Expected [Object] to be falsy', value: {} },
    ],
    toBeNaN: [
      { message: 'Expected 123 to be NaN', value: 123 },
      { message: 'Expected "" to be a <number>', value: '' },
    ],
    toBeNull: [
      { message: 'Expected <undefined> to strictly equal <null>', value: undefined, diff: { expected: undefined } },
      { message: 'Expected false to strictly equal <null>', value: false, diff: { expected: undefined } },
    ],
    toBeTrue: [
      { message: 'Expected false to strictly equal true', value: false, diff: { expected: true } },
      { message: 'Expected "foo" to strictly equal true', value: 'foo', diff: { expected: true } },
    ],
    toBeTruthy: [
      { message: 'Expected false to be truthy', value: false },
      { message: 'Expected 0 to be truthy', value: 0 },
      { message: 'Expected "" to be truthy', value: '' },
      { message: 'Expected <null> to be truthy', value: null },
      { message: 'Expected <undefined> to be truthy', value: undefined },
    ],
    toBeUndefined: [
      { message: 'Expected <null> to strictly equal <undefined>', value: null, diff: { expected: null } },
      { message: 'Expected "" to strictly equal <undefined>', value: '', diff: { expected: null } },
    ],
  } as const

  const negativeFailing = {
    toBeDefined: [
      { message: 'Expected false to be <null> or <undefined>', value: false },
      { message: 'Expected "" to be <null> or <undefined>', value: '' },
      { message: 'Expected 0 to be <null> or <undefined>', value: 0 },
    ],
    toBeNaN: [
      { message: 'Expected NaN not to be NaN', value: NaN },
      { message: 'Expected "" to be a <number>', value: '' },
    ],
  } as const

  describe('failing', () => {
    for (const [ k, tests ] of Object.entries(positiveFailing)) {
      const key = k as keyof typeof positiveFailing
      it(`should expect "${key}()"`, () => {
        for (const { message, value, ...x } of tests) {
          const diff = 'diff' in x ? { diff: true, value, ...x.diff } : undefined
          expectFail(() => expect(value)[key](), message, diff)
        }
      })
    }

    for (const [ k, tests ] of Object.entries(negativeFailing)) {
      const key = k as keyof typeof negativeFailing
      it(`should expect "not.${key}()"`, () => {
        for (const { message, value } of tests) {
          expectFail(() => expect(value).not[key](), message)
        }
      })
    }
  })
})
