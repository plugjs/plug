import { Expectations } from './expectations'
import { Matchers } from './matchers'

export { Expectations } from './expectations'

/* ========================================================================== *
 * EXPECT FUNCTION                                                            *
 * ========================================================================== */

type Expect = {
  <T = unknown>(value: T): Expectations<T>
} & Omit<Matchers, 'expect'>

/** The `expect` function exposing expectations and matchers */
export const expect: Expect = ((value: any) => new Expectations(value)) as Expect

for (const key of Object.getOwnPropertyNames(Matchers.prototype)) {
  if (! key.startsWith('to')) continue

  const matcher = (...args: any[]): any => ((new Matchers() as any)[key](...args))
  Object.defineProperty(matcher, 'name', { value: key })
  Object.defineProperty(expect, key, { value: matcher })
}

Object.defineProperty(expect, 'not', { get: () => new Matchers().not })
