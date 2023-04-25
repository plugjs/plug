import { ExpectationError, stringifyValue } from './types'

import type { Expectations, ExpectationsContext } from './expect'

/* Expects the value to be _defined_ (that is not `null` nor `undefined`). */
function toBeDefined<T>(this: T): T
function toBeDefined(this: ExpectationsContext): Expectations {
  return check(this, 'to be defined', (value) => (value !== null) && (value !== undefined))
}

/* Expects the value strictly equal to `false`. */
function toBeFalse(): Expectations<false>
function toBeFalse(this: ExpectationsContext): Expectations {
  return check(this, `to be ${stringifyValue(false)}`, (value) => value === false)
}

/* Expects the value to be _falsy_ (zero, empty string, `false`, ...). */
function toBeFalsy<T>(this: T): T
function toBeFalsy(this: ExpectationsContext): Expectations {
  return check(this, 'to be falsy', (value) => ! value)
}

/* Expects the value to be `NaN`. */
function toBeNaN(): Expectations<number>
function toBeNaN(this: ExpectationsContext): Expectations {
  return check(this, `to be ${stringifyValue(NaN)}`, (value) => (typeof value === 'number') && isNaN(value))
}

/* Expects the value to strictly equal to `-Infinity` (negative infinity). */
function toBeNegativeInfinity(): Expectations<number>
function toBeNegativeInfinity(this: ExpectationsContext): Expectations {
  return check(this, `to equal ${stringifyValue(Number.NEGATIVE_INFINITY)}`, (value) => value === Number.NEGATIVE_INFINITY)
}

/* Expects the value to strictly equal to `null`. */
function toBeNull(): Expectations<null>
function toBeNull(this: ExpectationsContext): Expectations {
  return check(this, `to be ${stringifyValue(null)}`, (value) => value === null)
}

/* Expects the value to strictly equal to `null` or `undefined`. */
function toBeNullable(): Expectations<null>
function toBeNullable(this: ExpectationsContext): Expectations {
  return check(
      this,
      `to be ${stringifyValue(null)} or ${stringifyValue(undefined)}`,
      (value) => ((value === null) || (value === undefined)))
}

/* Expects the value to strictly equal to `+Infinity` (positive infinity). */
function toBePositiveInfinity(): Expectations<number>
function toBePositiveInfinity(this: ExpectationsContext): Expectations {
  return check(this, `to equal ${stringifyValue(Number.POSITIVE_INFINITY)}`, (value) => value === Number.POSITIVE_INFINITY)
}

/* Expects the value to strictly equal to `true`. */
function toBeTrue(): Expectations<true>
function toBeTrue(this: ExpectationsContext): Expectations {
  return check(this, `to be ${stringifyValue(true)}`, (value) => value === true)
}

/* Expects the value to be _falsy_ (non-zero, non-empty string, `true`, ...). */
function toBeTruthy<T>(this: T): T
function toBeTruthy(this:ExpectationsContext): Expectations {
  return check(this, 'to be truthy', (value) => !! value)
}

/* Expects the value to strictly equal to `undefined`. */
function toBeUndefined(): Expectations<undefined>
function toBeUndefined(this: ExpectationsContext): Expectations {
  return check(this, `to be ${stringifyValue(undefined)}`, (value) => value === undefined)
}

/* === EXPORTS ============================================================== */

/* coverage ignore next */
export {
  toBeDefined,
  toBeFalse,
  toBeFalsy,
  toBeNaN,
  toBeNegativeInfinity,
  toBeNull,
  toBeNullable,
  toBePositiveInfinity,
  toBeTrue,
  toBeTruthy,
  toBeUndefined,
}

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

function check(
    context: ExpectationsContext,
    details: string,
    cb: (value: unknown) => boolean,
): Expectations {
  const match = cb(context.value)
  if (match === context._negative) {
    throw new ExpectationError(context, details)
  } else {
    return context._expectations
  }
}
