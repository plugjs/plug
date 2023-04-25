import { ExpectationError, assertContextType } from './types'

import type { Expectations } from './expect'
import type {
  AssertionFunction,
  Constructor,
  ExpectationsContext,
  JoinExpectations,
} from './types'

/* === TO THROW ============================================================= */

/** Expects the value to be a `function` throwing _anything_. */
function toThrow<T>(this: T): JoinExpectations<T, Function>

/**
 * Expects the value to be a `function` throwing, and asserts the
 * thrown value with the specified callback.
 */
function toThrow<T>(this: T, assert: AssertionFunction): JoinExpectations<T, Function>

/* Overloaded function implementation */
function toThrow(
    this: ExpectationsContext,
    assert?: AssertionFunction,
): Expectations {
  assertContextType(this, 'function')

  let thrown: boolean
  let error: unknown
  try {
    this.value()
    thrown = false
    error = undefined
  } catch (caught) {
    thrown = true
    error = caught
  }

  if (thrown === this._negative) {
    throw new ExpectationError(this, 'to throw')
  } else if (thrown && assert) {
    assert(this.forValue(error))
  }

  return this._expectations
}

/* === TO THROW ERROR ======================================================= */

/** Expects the value to be a `function` throwing an {@link Error}. */
function toThrowError<T>(this: T): JoinExpectations<T, Function>

/**
 * Expects the value to be a `function` throwing an {@link Error} with the
 * specified _message_.
 */
function toThrowError<T>(this: T, message: string): JoinExpectations<T, Function>

/**
 * Expects the value to be a `function` throwing an {@link Error} with its
 * _message_ matching the specified {@link RegExp}.
 */
function toThrowError<T>(this: T, expession: RegExp): JoinExpectations<T, Function>

/**
 * Expects the value to be a `function` throwing an {@link Error} of the
 * specified _type_.
 */
function toThrowError<T>(this: T, constructor: Constructor<Error>): JoinExpectations<T, Function>

/**
 * Expects the value to be a `function` throwing an {@link Error} of the
 * specified _type_ with the specified _message_.
 */
function toThrowError<T>(this: T, constructor: Constructor<Error>, message: string): JoinExpectations<T, Function>

/**
 * Expects the value to be a `function` throwing an {@link Error} of the
 * specified _type_ with its _message_ matching the specified {@link RegExp}.
 */
function toThrowError<T>(this: T, constructor: Constructor<Error>, expression: RegExp): JoinExpectations<T, Function>

/* Overloaded function implementation */
function toThrowError(
    this: ExpectationsContext,
    ...args:
    | []
    | [ string ]
    | [ RegExp ]
    | [ Constructor<Error> ]
    | [ Constructor<Error>, string ]
    | [ Constructor<Error>, RegExp ]
): Expectations {
  return this._negated.toThrow((assert) =>
    // @ts-ignore // can't reconcile the types with overloads...
    assert.toBeError(...args))
}

/* === EXPORTS ============================================================== */

/* coverage ignore next */
export {
  toThrow,
  toThrowError,
}
