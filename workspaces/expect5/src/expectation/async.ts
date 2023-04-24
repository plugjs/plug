import { ExpectationError } from './types'

import type { AssertedType, AssertionFunction, Expectations, ExpectationsContext } from './expect'
import type { Constructor, StringMatcher } from './types'

/* === TO BE RESOLVED ======================================================= */

/** Expects the value to be a _resolved_ {@link Promise}. */
function toBeResolved(): Promise<Expectations<Promise<unknown>>>

/**
 * Expects the value to be a _resolved_ {@link Promise}, and asserts the
 * resolved result with the specified callback.
 */
function toBeResolved<A extends AssertionFunction>(assert: A): Promise<Expectations<Promise<AssertedType<A>>>>

/* Overloaded function implementation */
function toBeResolved(
    this: ExpectationsContext,
    assert?: (resultExpectations: Expectations) => void,
): Promise<Expectations> {
  void assert
  return Promise.resolve()
      .then(() => {
        this._expectations.toHaveProperty('then', (a) => a.toBeA('function'))
        return Promise.allSettled([ Promise.resolve(this.value) ])
      })
      .then(([ settlement ]) => {
        if (settlement.status === 'fulfilled') {
          if (this._negative) throw new ExpectationError(this, true, 'to be resolved')
          if (assert) assert(this.forValue(settlement.value))
        } else if (! this._negative) {
          throw new ExpectationError(this, false, 'to be resolved')
        }

        return this._expectations
      })
}

/* === TO BE REJECTED ======================================================= */

/** Expect the value to be a _rejected_ {@link Promise}. */
function toBeRejected(): Promise<Expectations<Promise<unknown>>>

/**
 * Expect the value to be a _rejected_ {@link Promise}, and asserts the
 * rejection reason with the specified callback.
 */
function toBeRejected(assert: AssertionFunction): Promise<Expectations<Promise<unknown>>>

/* Overloaded function implementation */
function toBeRejected(
    this: ExpectationsContext,
    assert?: AssertionFunction,
): Promise<Expectations> {
  return Promise.resolve()
      .then(() => {
        this._expectations.toHaveProperty('then', (a) => a.toBeA('function'))
        return Promise.allSettled([ Promise.resolve(this.value) ])
      })
      .then(([ settlement ]) => {
        if (settlement.status === 'rejected') {
          if (this._negative) throw new ExpectationError(this, true, 'to be rejected')
          if (assert) assert(this.forValue(settlement.reason))
        } else if (! this._negative) {
          throw new ExpectationError(this, false, 'to be rejected')
        }

        return this._expectations
      })
}

/* === TO BE REJECTED WITH ERROR ============================================ */

/** Expect the value to be a {@link Promise} _rejected_ by an {@link Error}. */
function toBeRejectedWithError(): Promise<Expectations<Promise<unknown>>>

/**
 * Expect the value to be a {@link Promise} _rejected_ by an {@link Error}
 * with the specified _message_.
 */
function toBeRejectedWithError(message: string): Promise<Expectations<Promise<unknown>>>

/**
 * Expect the value to be a {@link Promise} _rejected_ by an {@link Error}
 * with its _message_ matching the specified {@link RegExp}.
 */
function toBeRejectedWithError(message: RegExp): Promise<Expectations<Promise<unknown>>>

/**
 * Expect the value to be a {@link Promise} _rejected_ by an {@link Error}
 * of the specified _type_.
 */
function toBeRejectedWithError(constructor: Constructor<Error>): Promise<Expectations<Promise<unknown>>>

/**
 * Expect the value to be a {@link Promise} _rejected_ by an {@link Error}
 * of the specified _type_ and with the specified _message_.
 */
function toBeRejectedWithError(constructor: Constructor<Error>, message: StringMatcher): Promise<Expectations<Promise<unknown>>>

/* Overloaded function implementation */
function toBeRejectedWithError(
    this: ExpectationsContext,
    ...args:
    | []
    | [ message: StringMatcher ]
    | [ constructor: Constructor<Error> ]
    | [ constructor: Constructor<Error>, message: StringMatcher ]
): Promise<Expectations> {
  return this.negated(this._negative)
      // @ts-ignore
      .toBeRejected((assert) => assert.toBeError(...args))
}

/* ========================================================================== */

/* coverage ignore next */
export { toBeResolved, toBeRejected, toBeRejectedWithError }
