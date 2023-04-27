import {
  Expectations,
} from './expectations'

export { Expectations } from './expectations'

/* ========================================================================== *
 * EXPECT FUNCTION                                                            *
 * ========================================================================== */

/** The `expect` function exposing expectations and matchers */
export const expect = (<T = unknown>(value: T): Expectations<T> => {
  return new Expectations(value)
})
