import { Expectations } from './expectations'
import { isMatcher } from './types'

import type { Matcher } from './matchers'
import type {
  AssertionFunction,
  AssertedType,
  InferToEqual,
  InferMatcher,
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
   * Expects the value to be a _rejected_ {@link PromiseLike}.
   *
   * Negation: {@link Expectations.toBeResolved `toBeResolved(...)`}
   */
  toBeRejected(): Promise<Expectations<PromiseLike<Awaited<T>>>>

  /**
   * Expects the value to be a _rejected_ {@link PromiseLike}, and further
   * validates the rejection with a {@link Matcher}.
   *
   * Negation: {@link Expectations.toBeResolved `toBeResolved(...)`}
   */
  toBeRejected(
    matcher: Matcher,
  ): Promise<Expectations<PromiseLike<Awaited<T>>>>

  /**
   * Expects the value to be a _rejected_ {@link PromiseLike}, and further
   * asserts the rejection reason with an {@link AssertionFunction}.
   *
   * Negation: {@link Expectations.toBeResolved `toBeResolved(...)`}
   */
  toBeRejected(
    assertion: AssertionFunction,
  ): Promise<Expectations<PromiseLike<Awaited<T>>>>

  toBeRejected(
      assertionOrMatcher?: AssertionFunction | Matcher,
  ): Promise<Expectations> {
    return Promise.resolve()
        .then(() => {
          this.toHaveProperty('then', (assert) => assert.toBeA('function'))
          return Promise.allSettled([ Promise.resolve(this.value) ])
        })
        .then(([ settlement ]) => {
          if (settlement.status === 'rejected') {
            if (isMatcher(assertionOrMatcher)) {
              assertionOrMatcher.expect(settlement.reason)
            } else if (assertionOrMatcher) {
              assertionOrMatcher(new Expectations(settlement.reason, this.remarks))
            }
            return this as Expectations<any>
          }

          this._fail('to be rejected')
        })
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a {@link PromiseLike} _rejected_ with an
   * {@link Error} {@link Expectations.toStrictlyEqual _strictly equal_}
   * to the one specified.
   *
   * Negation: {@link Expectations.toBeResolved `toBeResolved(...)`}
   */
  toBeRejectedWith(
      expected: Error,
  ): Promise<Expectations<PromiseLike<Awaited<T>>>> {
    return this.toBeRejected((assert) => assert.toStrictlyEqual(expected))
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
  ): Promise<Expectations<PromiseLike<Awaited<T>>>>

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
   * Expects the value to be a _resolved_ {@link PromiseLike}.
   *
   * Negation: {@link Expectations.toBeRejected `toBeRejected(...)`}
   */
  toBeResolved(): Promise<Expectations<PromiseLike<Awaited<T>>>>

  /**
   * Expects the value to be a _resolved_ {@link PromiseLike}, and further
   * validates the resolved result with a {@link Matcher}.
   *
   * Negation: {@link Expectations.toBeRejected `toBeRejected(...)`}
   */
  toBeResolved<Match extends Matcher>(
    matcher: Match,
  ): Promise<Expectations<PromiseLike<InferMatcher<unknown, Match>>>>

  /**
   * Expects the value to be a _resolved_ {@link PromiseLike}, and further
   * asserts the resolved result with an {@link AssertionFunction}.
   *
   * Negation: {@link Expectations.toBeRejected `toBeRejected(...)`}
   */
  toBeResolved<Assert extends AssertionFunction<Awaited<T>>>(
    assertion: Assert,
  ): Promise<Expectations<PromiseLike<AssertedType<Awaited<T>, Assert>>>>

  toBeResolved(
      assertion?: AssertionFunction | Matcher,
  ): Promise<Expectations> {
    return Promise.resolve()
        .then(() => {
          this.toHaveProperty('then', (assert) => assert.toBeA('function'))
          return Promise.allSettled([ Promise.resolve(this.value) ])
        })
        .then(([ settlement ]) => {
          if (settlement.status === 'fulfilled') {
            if (isMatcher(assertion)) {
              assertion.expect(settlement.value)
            } else if (assertion) {
              assertion(new Expectations(settlement.value, this.remarks))
            }
            return this as Expectations<any>
          }

          this._fail('to be resolved')
        })
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a {@link PromiseLike} _resolved_ with a value
   * {@link Expectations.toEqual _deeply equal_} to the one specified.
   *
   * Negation: {@link Expectations.toBeRejected `toBeRejected(...)`}
   */
  toBeResolvedWith<Type>(
      expected: Type,
  ): Promise<Expectations<PromiseLike<InferToEqual<Type>>>> {
    return this.toBeResolved((assert) => assert.toEqual(expected)) as any
  }
}
