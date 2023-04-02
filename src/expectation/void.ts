import { ExpectationError, assertType, stringifyValue } from './types'

import type { ExpectationContext, Expectation } from './expect'

/* ========================================================================== *
 * VOID EXPECTATION MATCHERS                                                  *
 * ========================================================================== */

export class VoidExpectation implements Expectation {
  constructor(
      private _details: string,
      private _check: (context: ExpectationContext) => boolean,
  ) {}


  expect(context: ExpectationContext): void {
    const { negative } = context

    const check = this._check(context)
    if (check !== negative) return

    throw new ExpectationError(context, this._details)
  }
}

/* ========================================================================== */

export const toBeDefined = new VoidExpectation('be defined',
    ({ value }) => (value !== null) && (value !== undefined),
)

export const toBeFalse = new VoidExpectation(`be ${stringifyValue(false)}`,
    ({ value }) => value === false,
)

export const toBeFalsy = new VoidExpectation('be falsy',
    ({ value }) => ! value,
)

export const toBeNaN = new VoidExpectation(`be ${stringifyValue(NaN)}`,
    ({ value }) => (typeof value === 'number') && isNaN(value),
)

export const toBeNegativeInfinity = new VoidExpectation(`equal ${stringifyValue(Number.NEGATIVE_INFINITY)}`,
    ({ value }) => value === Number.NEGATIVE_INFINITY,
)

export const toBeNull = new VoidExpectation(`be ${stringifyValue(null)}`,
    ({ value }) => value === null,
)

export const toBePositiveInfinity = new VoidExpectation(`equal ${stringifyValue(Number.POSITIVE_INFINITY)}`,
    ({ value }) => value === Number.POSITIVE_INFINITY,
)

export const toBeTrue = new VoidExpectation(`be ${stringifyValue(true)}`,
    ({ value }) => value === true,
)

export const toBeTruthy = new VoidExpectation('be truthy',
    ({ value }) => !! value,
)

export const toBeUndefined = new VoidExpectation(`be ${stringifyValue(undefined)}`,
    ({ value }) => value === undefined,
)

export const toThrow = new VoidExpectation('throw', (context) => {
  assertType(context, 'function')

  try {
    context.value()
    return false
  } catch (error) {
    return true
  }
})
