import { ExpectationError, stringifyValue } from './types'

import type { Expectations, ExpectationsContext } from './expect'

function check(
    context: ExpectationsContext,
    details: string,
    cb: (value: unknown) => boolean,
): Expectations {
  const match = cb(context.value)
  if (match === context._negative) {
    throw new ExpectationError(context, context._negative, details)
  } else {
    return context._expectations
  }
}

/* ========================================================================== */

function toBeDefined<T>(this: T): T
function toBeDefined(this: ExpectationsContext): Expectations {
  return check(this, 'to be defined', (value) => (value !== null) && (value !== undefined))
}

function toBeFalse(): Expectations<false>
function toBeFalse(this: ExpectationsContext): Expectations {
  return check(this, `to be ${stringifyValue(false)}`, (value) => value === false)
}

function toBeFalsy<T>(this: T): T
function toBeFalsy(this: ExpectationsContext): Expectations {
  return check(this, 'to be falsy', (value) => ! value)
}

function toBeNaN(): Expectations<number>
function toBeNaN(this: ExpectationsContext): Expectations {
  return check(this, `to be ${stringifyValue(NaN)}`, (value) => (typeof value === 'number') && isNaN(value))
}

function toBeNegativeInfinity(): Expectations<number>
function toBeNegativeInfinity(this: ExpectationsContext): Expectations {
  return check(this, `to equal ${stringifyValue(Number.NEGATIVE_INFINITY)}`, (value) => value === Number.NEGATIVE_INFINITY)
}

function toBeNull(): Expectations<null>
function toBeNull(this: ExpectationsContext): Expectations {
  return check(this, `to be ${stringifyValue(null)}`, (value) => value === null)
}

function toBePositiveInfinity(): Expectations<number>
function toBePositiveInfinity(this: ExpectationsContext): Expectations {
  return check(this, `to equal ${stringifyValue(Number.POSITIVE_INFINITY)}`, (value) => value === Number.POSITIVE_INFINITY)
}

function toBeTrue(): Expectations<true>
function toBeTrue(this: ExpectationsContext): Expectations {
  return check(this, `to be ${stringifyValue(true)}`, (value) => value === true)
}

function toBeTruthy<T>(this: T): T
function toBeTruthy(this:ExpectationsContext): Expectations {
  return check(this, 'to be truthy', (value) => !! value)
}

function toBeUndefined(): Expectations<undefined>
function toBeUndefined(this: ExpectationsContext): Expectations {
  return check(this, `to be ${stringifyValue(undefined)}`, (value) => value === undefined)
}

/* coverage ignore next */
export {
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
}
