import { AsyncExpectations } from './async'
import { Matchers } from './matchers'

export type { AsyncExpectations } from './async'
export type { Expectations, NegativeExpectations } from './expectations'
export type { Matchers, NegativeMatchers } from './matchers'

/* ========================================================================== *
 * EXPECT FUNCTION                                                            *
 * ========================================================================== */

/** The `expect` function exposing expectations and matchers */
export type Expect = {
  <T = unknown>(value: T, remarks?: string): AsyncExpectations<T>
} & Omit<Matchers, 'expect'>

/** The `expect` function exposing expectations and matchers */
export const expect: Expect = ((value: any, remarks?: string) => {
  return new AsyncExpectations(value, remarks)
}) as Expect

/* Inject all our matchers constructors in the `expect` function */
for (const key of Object.getOwnPropertyNames(Matchers.prototype)) {
  if (! key.startsWith('to')) continue

  const matcher = (...args: any[]): any => ((new Matchers() as any)[key](...args))
  Object.defineProperty(matcher, 'name', { value: key })
  Object.defineProperty(expect, key, { value: matcher })
}

/* Inject the negative matcher constructor in the `expect` function */
Object.defineProperty(expect, 'not', { get: () => new Matchers().not })
