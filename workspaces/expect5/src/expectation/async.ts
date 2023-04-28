import {
  Expectations,
  type AssertionFunction,
  type AssertedType,
} from './expectations'

import type { Constructor } from './types'

/**
 * Extension to {@link Expectations} adding support for {@link Promise}s.
 *
 * These expectations are _separate_ from the main {@link Expectations}, as we
 * can't use them in {@link AssertionFunction}s, without ending up with
 * _unhandled rejections_ in the Node.js process.
 */
export class AsyncExpectations<T = unknown> extends Expectations<T> {
  /**
   * Create an {@link AsyncExpectations} instance associated with the specified
   * value and error remarks.
   */
  constructor(value: T, remarks: string | undefined) {
    super(value, remarks)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a _rejected_ {@link PromiseLike}, and (if
   * specified) further asserts the rejection reason with an
   * {@link AssertionFunction}.
   *
   * Negation: {@link Expectations.toBeResolved `toBeResolved(...)`}
   */
  toBeRejected(
      assertion?: AssertionFunction,
  ): Promise<Expectations<PromiseLike<Awaited<T>>>> {
    return Promise.resolve()
        .then(() => {
          this.toHaveProperty('then', (assert) => assert.toBeA('function'))
          return Promise.allSettled([ Promise.resolve(this.value) ])
        })
        .then(([ settlement ]) => {
          if (settlement.status === 'rejected') {
            if (assertion) assertion(new Expectations(settlement.reason, this.remarks))
            return this as Expectations<any>
          }

          this._fail('to be rejected')
        })
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expect the value to be a _rejected_ {@link PromiseLike}, and further
   * asserts the rejection reason to be an {@link Error}.
   *
   * If specified, the {@link Error}'s own message will be further expected to
   * either match the specified {@link RegExp}, or equal to the specified
   * `string`.
   *
   * Negation: {@link Expectations.toBeResolved `toBeResolved(...)`}
   */
  toBeRejectedWithError(
    message?: string | RegExp
  ): Promise<Expectations<PromiseLike<Awaited<T>>>>

  /**
   * Expect the value to be a _rejected_ {@link PromiseLike}, and further
   * asserts the rejection reason to be an instance of the specifed
   * {@link Error} {@link Constructor}.
   *
   * If specified, the {@link Error}'s own message will be further expected to
   * either match the specified {@link RegExp}, or equal to the specified
   * `string`.
   *
   * Negation: {@link Expectations.toBeResolved `toBeResolved(...)`}
   */
  toBeRejectedWithError(
    constructor: Constructor<Error>,
    message?: string | RegExp,
  ): Promise<Expectations<PromiseLike<T>>>

  toBeRejectedWithError(
      constructorOrMessage?: string | RegExp | Constructor,
      maybeMessage?: string | RegExp,
  ): Promise<Expectations> {
    const [ constructor, message ] =
      typeof constructorOrMessage === 'function' ?
        [ constructorOrMessage, maybeMessage ] :
        [ Error, constructorOrMessage ]

    return this.toBeRejected((assert) => assert.toBeError(constructor, message))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a _resolved_ {@link PromiseLike}, and (if
   * specified) further asserts the resolved result with an
   * {@link AssertionFunction}.
   *
   * Negation: {@link Expectations.toBeRejected `toBeRejected(...)`}
   */
  toBeResolved<Assert extends AssertionFunction<Awaited<T>>>(
      assertion?: Assert,
  ): Promise<Expectations<PromiseLike<AssertedType<Awaited<T>, Assert>>>> {
    return Promise.resolve()
        .then(() => {
          this.toHaveProperty('then', (assert) => assert.toBeA('function'))
          return Promise.allSettled([ Promise.resolve(this.value) ])
        })
        .then(([ settlement ]) => {
          if (settlement.status === 'fulfilled') {
            if (assertion) assertion(new Expectations(settlement.value, this.remarks))
            return this as Expectations<any>
          }

          this._fail('to be resolved')
        })
  }
}
