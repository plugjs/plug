import {
  toBeRejected,
  toBeRejectedWithError,
  toBeResolved,
} from './async'
import {
  toBeA,
  toBeCloseTo,
  toBeError,
  toBeGreaterThan,
  toBeGreaterThanOrEqual,
  toBeInstanceOf,
  toBeLessThan,
  toBeLessThanOrEqual,
  toBeWithinRange,
  toEqual,
  toHaveLength,
  toHaveProperty,
  toHaveSize,
  toMatch,
  toStrictlyEqual,
} from './basic'
import {
  toInclude,
  toMatchContents,
} from './include'
import {
  toThrow,
  toThrowError,
} from './throwing'
import {
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
} from './trivial'
import {
  ExpectationError,
  matcherMarker,
} from './types'

import type {
  ExpectationsContext,
  ExpectationsParent,
} from './types'

/* ========================================================================== *
 * IMPORT AND PREPARE EXTERNAL EXPECTATIONS                                   *
 * ========================================================================== */

const asyncExpectations = {
  toBeResolved,
  toBeRejected,
  toBeRejectedWithError,
} as const

type AsyncExpectations = typeof asyncExpectations

const syncExpectations = {
  // basic
  toBeA,
  toBeCloseTo,
  toBeError,
  toBeGreaterThan,
  toBeGreaterThanOrEqual,
  toBeInstanceOf,
  toBeLessThan,
  toBeLessThanOrEqual,
  toBeWithinRange,
  toEqual,
  toHaveLength,
  toHaveProperty,
  toHaveSize,
  toMatch,
  toStrictlyEqual,

  // include
  toInclude,
  toMatchContents,

  // throwing
  toThrow,
  toThrowError,

  // trivial
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
} as const

type SyncExpectations = typeof syncExpectations

const allExpectations = {
  ...asyncExpectations,
  ...syncExpectations,
}

type AllExpectations = SyncExpectations & AsyncExpectations

/* ========================================================================== *
 * OVERLOADED FUNCTIONS TYPES                                                 *
 * ========================================================================== */

/** Combine the arguments of a number of overloads (tuples) */
type OverloadArguments<T> =
  T extends readonly [ infer T, ...infer Rest ] ?
    [ T, ...OverloadArguments<Rest> ] :
  T extends readonly [] ? [] :
  T extends readonly (infer T)[] ?
    unknown extends T ? never :
    T extends undefined ? [] :
    [ T ] :
  never

/**
 * Remap `Functions` (a record of functions) inferring arguments and forcing
 * return type to `Result`
 */
type OverloadFunctions<Functions, Result> = {
  [ k in keyof Functions ]:
    Functions[k] extends {
      (...args: infer A0): any
      (...args: infer A1): any
      (...args: infer A2): any
      (...args: infer A3): any
      (...args: infer A4): any
      (...args: infer A5): any
    } ? (...args: OverloadArguments<A0 | A1 | A2 | A3 | A4 | A5>) => Result :
    Functions[k] extends {
      (...args: infer A0): any
      (...args: infer A1): any
      (...args: infer A2): any
      (...args: infer A3): any
      (...args: infer A4): any
    } ? (...args: OverloadArguments<A0 | A1 | A2 | A3 | A4>) => Result :
    Functions[k] extends {
      (...args: infer A0): any
      (...args: infer A1): any
      (...args: infer A2): any
      (...args: infer A3): any
    } ? (...args: OverloadArguments<A0 | A1 | A2 | A3>) => Result :
    Functions[k] extends {
      (...args: infer A0): any
      (...args: infer A1): any
      (...args: infer A2): any
    } ? (...args: OverloadArguments<A0 | A1 | A2>) => Result :
    Functions[k] extends {
      (...args: infer A0): any
      (...args: infer A1): any
    } ? (...args: OverloadArguments<A0 | A1>) => Result :
    Functions[k] extends {
      (...args: infer A0): any
    } ? (...args: OverloadArguments<A0>) => Result :
    never
}

/* ========================================================================== *
 * EXPECTATIONS DEFINITION                                                    *
 * ========================================================================== */

/**
 * Expectation functions simply check a _value_, but do not alter the type
 * returned by each expectation.
 */
export interface ExpectationFunctions<T> extends
  OverloadFunctions<AsyncExpectations, Promise<Expectations<PromiseLike<T>>>>,
  OverloadFunctions<SyncExpectations, Expectations<T>> {
  // empty interface, specifically without `value` or `not` so that
  // in no way this can be confused with the full `Expectations<T>`.
}

/**
 * An interface describing all expectations returned by `expect(...)`.
 *
 * Each function, upon checking, might return an expectation bound to a
 * different _type_ (for example `.toBeNull()` returns always
 * `Expectations<null>`, inferring that `value` is indeed `null`).
 */
export interface Expectations<T = unknown> extends AllExpectations {
  /** The value this {@link Expectations} instance operates on */
  readonly value: T
  /** The _negated_ expectations of _this_ {@link Expectations} instance. */
  readonly not: ExpectationFunctions<T>
}

/* ========================================================================== *
 * EXPECTATIONS IMPLEMENTATION                                                *
 * ========================================================================== */

class ExpectationsContextImpl<T = unknown> implements ExpectationsContext<T> {
  constructor(
      readonly value: T,
      readonly negative: boolean,
      readonly expects: Expectations<T>,
      readonly negated: ExpectationFunctions<T>,
      readonly parent?: ExpectationsParent,
  ) {}

  forValue<V>(value: V): Expectations<V> {
    return new ExpectationsImpl(value)
  }

  forProperty(prop: string | number | symbol): Expectations<unknown> {
    this.expects.toBeDefined()

    const value = (this.value as any)[prop]
    const parent = { context: this, prop }
    return new ExpectationsImpl(value, parent)
  }
}

/** Empty interface: the `class` below won't complain about missing stuff */
interface ExpectationsImpl<T = unknown> extends Expectations<T> {}

/** Implementation of our {@link Expectations} interface */
class ExpectationsImpl<T = unknown> implements Expectations<T> {
  private readonly _context: ExpectationsContext<T>

  readonly value: T
  readonly not: ExpectationFunctions<T>

  constructor(
      value: T,
      parent?: ExpectationsParent,
      positives?: Expectations<T>,
  ) {
    this.value = value

    if (positives) {
      this.not = positives as ExpectationFunctions<any>
      this._context = new ExpectationsContextImpl(
          value,
          true,
          positives,
          this as ExpectationFunctions<any>,
          parent)
    } else {
      this._context = new ExpectationsContextImpl(
          value,
          false,
          this,
          this as ExpectationFunctions<any>,
          parent)
      this.not = new ExpectationsImpl(value, parent, this) as ExpectationFunctions<any>
    }
  }

  /* == STATIC INITALIZER =================================================== */

  static {
    for (const [ key, value ] of Object.entries(allExpectations)) {
      const expectation = value as (this: ExpectationsContext, ...args: any[]) => any

      const fn = function(this: ExpectationsImpl, ...args: any[]): any {
        try {
          return expectation.call(this._context, ...args)
        } catch (error) {
          if (error instanceof ExpectationError) Error.captureStackTrace(error, fn)
          throw error
        }
      }

      Object.defineProperty(fn, 'name', { value: key })
      Object.defineProperty(this.prototype, key, { value: fn })
    }
  }
}

/* ========================================================================== *
 * EXPECTATIONS MATCHERS                                                      *
 * ========================================================================== */

/** An interface describing all expectations returned by `expect(...)` */
export interface Matchers extends OverloadFunctions<SyncExpectations, Matchers> {
  not: Matchers
  /* The assertion here will trigger */
  expect(value: unknown): void
}

interface MatcherImpl extends Matchers {}

class MatcherImpl {
  private readonly _matchers: readonly [ string, boolean, any[] ][]
  private readonly _positiveBuilder: MatcherImpl
  private readonly _negativeBuilder: MatcherImpl
  private readonly _negative: boolean

  constructor(
      _matchers: readonly [ string, boolean, any[] ][],
      _positiveBuilder?: MatcherImpl,
  ) {
    this._matchers = _matchers
    if (_positiveBuilder) {
      this._negative = true
      this._positiveBuilder = _positiveBuilder
      this._negativeBuilder = this
    } else {
      this._negative = false
      this._positiveBuilder = this
      this._negativeBuilder = new MatcherImpl(this._matchers, this)
    }
  }

  get not(): MatcherImpl {
    return this._negative ? this._positiveBuilder : this._negativeBuilder
  }

  expect(value: unknown): void {
    const expectations = expect(value)
    for (const [ expectation, negative, args ] of this._matchers) {
      const expect = negative ? expectations.not as any : expectations as any
      expect[expectation](...args)
    }
  }

  /* == STATIC INITALIZER =================================================== */

  static {
    // for "isMatcher(...)" used by "diff(...)"
    Object.defineProperty(this.prototype, matcherMarker, { value: matcherMarker })

    // all our matchers
    for (const key in syncExpectations) {
      Object.defineProperty(this.prototype, key, {
        value: function(this: MatcherImpl, ...args: any[]): any {
          return new MatcherImpl([
            ...this._matchers, [ key, this._negative, args ],
          ])
        },
      })
    }
  }
}

/* ========================================================================== *
 * EXPECT FUNCTION                                                            *
 * ========================================================================== */

/** The `expect` function exposing expectations and matchers */
export const expect = (<T = unknown>(value: T): Expectations<T> => {
  return new ExpectationsImpl(value)
}) as Matchers & (<T = unknown>(value: T) => Expectations<T>)

// Instrument a getter for negative matchers
Object.defineProperty(expect, 'not', {
  get: () => new MatcherImpl([]).not,
})

// Create a matcher for each expectation function
for (const name in syncExpectations) {
  Object.defineProperty(expect, name, {
    value: function(...args: any[]): Matchers {
      const builder = new MatcherImpl([])
      return (builder as any)[name](...args)
    },
  })
}
