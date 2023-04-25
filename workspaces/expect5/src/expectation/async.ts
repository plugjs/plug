import { ExpectationError } from './types'

import type { Expectations } from './expect'
import type {
  AssertedType,
  AssertionFunction,
  Constructor,
  ExpectationsContext,
} from './types'

/**
 * A {@link Promise} for an {@link Expectations} instance expecting a
 * _then-able_ {@link PromiseLike}.
 *
 * Long story short: the {@link toBeResolved}, {@link toBeRejectedWithError} and
 * {@link toBeRejected} expectations are asynchronous, henceforth they return
 * the first {@link Promise} to an {@link Expectations} instance. They also
 * ensure that the value being expected is a _then-able_ {@link PromiseLike}.
 */
type ExpectationsPromise<E, T2 = unknown> =
  unknown extends T2 ?
    E extends Expectations<infer T1> ?
      Promise<Expectations<PromiseLike<Awaited<T1>>>> :
      Promise<Expectations<PromiseLike<unknown>>> :
      Promise<Expectations<PromiseLike<T2>>>

/* === TO BE RESOLVED ======================================================= */

/** Expects the value to be a _resolved_ {@link PromiseLike}. */
function toBeResolved<T>(this: T): ExpectationsPromise<T>

/**
 * Expects the value to be a _resolved_ {@link Promise}, and asserts the
 * resolved result with the specified callback.
 */
function toBeResolved<T, A extends AssertionFunction>(
  this: T,
  assert: A,
): ExpectationsPromise<T, AssertedType<A>>

/* Overloaded function implementation */
function toBeResolved(
    this: ExpectationsContext,
    assert?: (resultExpectations: Expectations) => void,
): Promise<Expectations> {
  void assert
  return Promise.resolve()
      .then(() => {
        this.expects.toHaveProperty('then', (a) => a.toBeA('function'))
        return Promise.allSettled([ Promise.resolve(this.value) ])
      })
      .then(([ settlement ]) => {
        if (settlement.status === 'fulfilled') {
          if (this.negative) throw new ExpectationError(this, 'to be resolved')
          if (assert) assert(this.forValue(settlement.value))
        } else if (! this.negative) {
          throw new ExpectationError(this, 'to be resolved')
        }

        return this.expects
      })
}

/* === TO BE REJECTED ======================================================= */

/** Expect the value to be a _rejected_ {@link Promise}. */
function toBeRejected<T>(this: T): ExpectationsPromise<T>

/**
 * Expect the value to be a _rejected_ {@link Promise}, and asserts the
 * rejection reason with the specified callback.
 */
function toBeRejected<T>(this: T, assert: AssertionFunction): ExpectationsPromise<T>

/* Overloaded function implementation */
function toBeRejected(
    this: ExpectationsContext,
    assert?: AssertionFunction,
): Promise<Expectations> {
  return Promise.resolve()
      .then(() => {
        this.expects.toHaveProperty('then', (a) => a.toBeA('function'))
        return Promise.allSettled([ Promise.resolve(this.value) ])
      })
      .then(([ settlement ]) => {
        if (settlement.status === 'rejected') {
          if (this.negative) throw new ExpectationError(this, 'to be rejected')
          if (assert) assert(this.forValue(settlement.reason))
        } else if (! this.negative) {
          throw new ExpectationError(this, 'to be rejected')
        }

        return this.expects
      })
}

/* === TO BE REJECTED WITH ERROR ============================================ */

/** Expect the value to be a {@link Promise} _rejected_ by an {@link Error}. */
function toBeRejectedWithError<T>(this: T, ): ExpectationsPromise<T>

/**
 * Expect the value to be a {@link Promise} _rejected_ by an {@link Error}
 * with the specified _message_.
 */
function toBeRejectedWithError<T>(this: T, message: string): ExpectationsPromise<T>

/**
 * Expect the value to be a {@link Promise} _rejected_ by an {@link Error}
 * with its _message_ matching the specified {@link RegExp}.
 */
function toBeRejectedWithError<T>(this: T, message: RegExp): ExpectationsPromise<T>

/**
 * Expect the value to be a {@link Promise} _rejected_ by an {@link Error}
 * of the specified _type_.
 */
function toBeRejectedWithError<T>(this: T, constructor: Constructor<Error>): ExpectationsPromise<T>

/**
 * Expect the value to be a {@link Promise} _rejected_ by an {@link Error}
 * of the specified _type_ and with the specified _message_.
 */
function toBeRejectedWithError<T>(this: T, constructor: Constructor<Error>, message: string): ExpectationsPromise<T>

/**
 * Expect the value to be a {@link Promise} _rejected_ by an {@link Error}
 * of the specified _type_ and with the specified _message_.
 */
function toBeRejectedWithError<T>(this: T, constructor: Constructor<Error>, message: RegExp): ExpectationsPromise<T>

/* Overloaded function implementation */
function toBeRejectedWithError(
    this: ExpectationsContext,
    ...args:
    | []
    | [ string ]
    | [ RegExp ]
    | [ Constructor<Error> ]
    | [ Constructor<Error>, string ]
    | [ Constructor<Error>, RegExp ]
): Promise<Expectations> {
  return this.negated.toBeRejected((assert) =>
    // @ts-ignore // can't reconcile the types with overloads...
    assert.toBeError(...args))
}

/* === EXPORTS ============================================================== */

/* coverage ignore next */
export { toBeResolved, toBeRejected, toBeRejectedWithError }
