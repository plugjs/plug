import {
  toBeA,
  toBeInstanceOf,
  toHaveLength,
  toMatch,
  toStrictlyEqual,
  toThrowError,
  toThrowMatching,
} from './basic'
import {
  VoidExpectation,
  toBeDefined,
  toBeFalse,
  toBeFalsy,
  toBeNaN,
  toBeNegativeInfinity,
  toBeNull,
  toBePositiveInfinity,
  toBeTrue,
  toBeTruthy,
  toBeUndefined,
  toThrow,
} from './void'

export interface ExpectationContext<T = unknown> {
  value: T,
  expectation: string,
  negative: boolean,
  from: Function,
}

export interface Expectation {
  expect(context: ExpectationContext, ...args: any[]): void | Promise<void>
}

export const expectations = {
  // basic expectations
  toBeA,
  toBeInstanceOf,
  toHaveLength,
  toMatch,
  toStrictlyEqual,
  toThrow,
  toThrowError,
  toThrowMatching,

  // void expectations
  toBeDefined,
  toBeFalse,
  toBeFalsy,
  toBeNaN,
  toBeNegativeInfinity,
  toBeNull,
  toBePositiveInfinity,
  toBeTrue,
  toBeTruthy,
  toBeUndefined,
} as const

export type ExpectationsByName = typeof expectations

export type ExpectationParameters<T> =
  T extends Expectation ?
    Parameters<T['expect']> extends [ any, ...infer P ] ? P : never :
  never

export type ExpectationReturn<T> =
  T extends Expectation ?
    ReturnType<T['expect']> extends Promise<any> ?
      Promise<Expectations> :
      Expectations :
  never

export type Expectations = {
  [ k in keyof ExpectationsByName ]: (
    ...args: ExpectationParameters<ExpectationsByName[k]>
  ) => ExpectationReturn<ExpectationsByName[k]>
}

function makeProxy(
    value: unknown,
    negative: boolean = false,
): Expectations & { not: Expectations } {
  const proxy = new Proxy(Object.create(null), {
    ownKeys: () => [ ...Object.keys(expectations), 'not' ],
    has: (_target, expectation) => expectation === 'not' ? true : (expectation in expectations),
    get: (_target, expectation: keyof Expectations | 'not'): any => {
      // The "not" property simply returns a negated proxy
      if (expectation === 'not') return makeProxy(value, !negative)

      // Get our expectation
      const instance: Expectation = expectations[expectation]
      if (! instance) throw new TypeError(`Unknown expectation "${expectation}"`)

      // Create our context
      const from = instance.expect
      const context: ExpectationContext = { value, expectation, negative, from }

      // Create our wrapper
      let wrapper: () => Expectations | Promise<Expectations>
      if (instance instanceof VoidExpectation) {
        // Void expectations are expected on "get", which basically means that
        // typos such as "toBeNull" (not "toBeNull()") will run tests correctly
        instance.expect(context)
        wrapper = (): Expectations => proxy
      } else {
        // Non-void expectations will simply be wrapped...
        wrapper = (...args: readonly any[]): Expectations | Promise<Expectations> => {
          const result = instance.expect(context, ...args)
          if (! result) return proxy
          return result.then(() => proxy)
        }
      }

      // Nice-ify our wrapper's name and return it
      Object.defineProperty(wrapper, 'name', { value: expectation })
      return wrapper
    },
  })

  // Return our proxy
  return proxy
}


export function expect(value: unknown): Expectations & { not: Expectations } {
  return makeProxy(value)
}
