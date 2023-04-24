import { ExpectationError, matcherMarker } from './types'
import {
  toBeResolved,
  toBeRejected,
  toBeRejectedWithError,
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
  toBePositiveInfinity,
  toBeTrue,
  toBeTruthy,
  toBeUndefined,
} from './trivial'

/* ========================================================================== *
 * IMPORT AND PREPARE EXTERNAL EXPECTATIONS                                   *
 * ========================================================================== */

const expectationsFunctions = {
  // async
  toBeResolved,
  toBeRejected,
  toBeRejectedWithError,

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
  toBePositiveInfinity,
  toBeTrue,
  toBeTruthy,
  toBeUndefined,
}

type ExpectationsFunctions = typeof expectationsFunctions

/* ========================================================================== *
 * EXPECTATIONS DEFINITION                                                    *
 * ========================================================================== */

export type JoinExpectations<E, T2> =
  E extends Expectations<infer T1> ? Expectations<T1 & T2> : Expectations<T2>

export type AssertionFunction<T = unknown> = (assert: Expectations<T>) => void | Expectations

export type AssertedType<F extends AssertionFunction<any>, R = ReturnType<F>> =
  R extends Expectations<infer T> ? T : unknown

/** An interface describing all expectations returned by `expect(...)` */
export interface Expectations<T = unknown> extends ExpectationsFunctions {
  /** The value this {@link Expectations} instance operates on */
  readonly value: T

  /** The _negated_ expectations of _this_ {@link Expectations} instance. */
  readonly not: Expectations<T>
}

export interface ExpectationsContext<T = unknown> {
  readonly value: T,
  readonly _negative: boolean,
  readonly _parent?: ExpectationsParent
  readonly _expectations: Expectations<T>
  readonly _negated: Expectations<T>

  forValue<V>(value: V): ExpectationsContext<V>,
  forProperty(prop: string | number | symbol): ExpectationsContext
}


/** Parent expectations */
export interface ExpectationsParent {
  context: ExpectationsContext,
  prop: string | number | symbol,
}

/* ========================================================================== *
 * EXPECTATIONS IMPLEMENTATION                                                *
 * ========================================================================== */

class ExpectationsContextImpl<T = unknown> implements ExpectationsContext<T> {
  readonly value: T
  readonly _negative: boolean
  readonly _parent?: ExpectationsParent
  readonly _expectations: Expectations<T>
  readonly _negated: Expectations<T>

  constructor(value: T, negative: boolean, parent?: ExpectationsParent) {
    this.value = value
    this._negative = negative
    this._parent = parent

    this._expectations = new ExpectationsImpl(value)
    this._negated = negative ? this._expectations.not : this._expectations
  }

  forValue<V>(value: V): ExpectationsContext<V> {
    return new ExpectationsContextImpl(value, false)
  }

  forProperty(prop: string | number | symbol): ExpectationsContext<unknown> {
    this._expectations.toBeDefined()

    const value = (this.value as any)[prop]
    const parent = { context: this, prop }
    return new ExpectationsImpl(value, undefined, parent)
  }
}

void ExpectationsContextImpl

/** Empty interface: the `class` below won't complain about missing stuff */
interface ExpectationsImpl<T = unknown> extends Expectations<T> {}

/** Implementation of our {@link Expectations} interface */
class ExpectationsImpl<T = unknown> implements Expectations<T> {
  private readonly _positiveExpectations: ExpectationsImpl<T>
  private readonly _negativeExpectations: ExpectationsImpl<T>

  readonly _expectations: ExpectationsImpl<T>
  readonly _negative: boolean
  readonly _negated: ExpectationsImpl<T>
  readonly _parent?: ExpectationsParent

  readonly not: ExpectationsImpl<T>

  constructor(
      public readonly value: T,
      _positiveExpectations?: ExpectationsImpl<T>,
      _parent?: ExpectationsParent,
  ) {
    if (_positiveExpectations) {
      this._negative = true
      this._positiveExpectations = _positiveExpectations
      this._negativeExpectations = this
    } else {
      this._negative = false
      this._positiveExpectations = this
      this._negativeExpectations = new ExpectationsImpl(value, this, this._parent)
    }
    this._parent = _parent
    this._expectations = this._positiveExpectations
    this._negated = this._negative ? this._negativeExpectations : this._positiveExpectations
    this.not = this._negative ? this._positiveExpectations : this._negativeExpectations
  }

  /* == NEW EXPECTATIONS ==================================================== */

  forProperty(prop: string | number | symbol): ExpectationsImpl {
    this.toBeDefined()

    const value = (this.value as any)[prop]
    const parent = { context: this, prop }
    return new ExpectationsImpl(value, undefined, parent)
    // child._parent = { context: this, prop }
    // return child
  }

  forValue<T = unknown>(value: T): ExpectationsImpl<T> {
    return new ExpectationsImpl(value)
  }

  /* == NEGATION ============================================================ */

  // get not(): ExpectationsImpl<T> {
  //   return this._negative ? this._positiveExpectations : this._negativeExpectations
  // }

  /* == STATIC INITALIZER =================================================== */

  static {
    for (const [ key, value ] of Object.entries(expectationsFunctions)) {
      const expectation = value as (this: ExpectationsContext, ...args: any[]) => any

      const fn = function(this: ExpectationsImpl, ...args: any[]): any {
        try {
          return expectation.call(this, ...args)
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

type MatchersArguments<T> =
  T extends readonly [ infer T, ...infer Rest ] ?
    [ T, ...MatchersArguments<Rest> ] :
  T extends readonly [] ? [] :
  T extends readonly (infer T)[] ?
    unknown extends T ? never :
    T extends undefined ? [] :
    [ T ] :
  never

type MatchersFunctions = {
  [ k in keyof ExpectationsFunctions ]:
    ExpectationsFunctions[k] extends {
      (...args: infer A0): Expectations
      (...args: infer A1): Expectations
      (...args: infer A2): Expectations
      (...args: infer A3): Expectations
      (...args: infer A4): Expectations
      (...args: infer A5): Expectations
    } ? (...args: MatchersArguments<A0 | A1 | A2 | A3 | A4 | A5>) => ExpectationsMatcher :
    ExpectationsFunctions[k] extends {
      (...args: infer A0): Expectations
      (...args: infer A1): Expectations
      (...args: infer A2): Expectations
      (...args: infer A3): Expectations
      (...args: infer A4): Expectations
    } ? (...args: MatchersArguments<A0 | A1 | A2 | A3 | A4>) => ExpectationsMatcher :
    ExpectationsFunctions[k] extends {
      (...args: infer A0): Expectations
      (...args: infer A1): Expectations
      (...args: infer A2): Expectations
      (...args: infer A3): Expectations
    } ? (...args: MatchersArguments<A0 | A1 | A2 | A3>) => ExpectationsMatcher :
    ExpectationsFunctions[k] extends {
      (...args: infer A0): Expectations
      (...args: infer A1): Expectations
      (...args: infer A2): Expectations
    } ? (...args: MatchersArguments<A0 | A1 | A2>) => ExpectationsMatcher :
    ExpectationsFunctions[k] extends {
      (...args: infer A0): Expectations
      (...args: infer A1): Expectations
    } ? (...args: MatchersArguments<A0 | A1>) => ExpectationsMatcher :
    ExpectationsFunctions[k] extends {
      (...args: infer A0): Expectations
    } ? (...args: MatchersArguments<A0>) => ExpectationsMatcher :
    never
}

/** An interface describing all expectations returned by `expect(...)` */
export interface ExpectationsMatcher extends MatchersFunctions {
  not: ExpectationsMatcher
  /* The assertion here will trigger */
  expect(value: unknown): void
}

interface ExpectationsMatcherImpl extends ExpectationsMatcher {}

class ExpectationsMatcherImpl {
  private readonly _matchers: readonly [ string, boolean, any[] ][]
  private readonly _positiveBuilder: ExpectationsMatcherImpl
  private readonly _negativeBuilder: ExpectationsMatcherImpl
  private readonly _negative: boolean

  constructor(
      _matchers: readonly [ string, boolean, any[] ][],
      _positiveBuilder?: ExpectationsMatcherImpl,
  ) {
    this._matchers = _matchers
    if (_positiveBuilder) {
      this._negative = true
      this._positiveBuilder = _positiveBuilder
      this._negativeBuilder = this
    } else {
      this._negative = false
      this._positiveBuilder = this
      this._negativeBuilder = new ExpectationsMatcherImpl(this._matchers, this)
    }
  }

  get not(): ExpectationsMatcherImpl {
    return this._negative ? this._positiveBuilder : this._negativeBuilder
  }

  expect(value: unknown): void {
    const expectations = new ExpectationsImpl(value)
    for (const [ expectation, negative, args ] of this._matchers) {
      const expect = negative ? expectations.not : expectations
      ;(expect as any)[expectation](...args) // TODO: context!
    }
  }

  /* == STATIC INITALIZER =================================================== */

  static {
    // for "isMatcher(...)" used by "diff(...)"
    Object.defineProperty(this.prototype, matcherMarker, { value: matcherMarker })

    // all our matchers
    for (const key in expectationsFunctions) {
      Object.defineProperty(this.prototype, key, {
        value: function(this: ExpectationsMatcherImpl, ...args: any[]): any {
          return new ExpectationsMatcherImpl([
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
}) as ExpectationsMatcher & (<T = unknown>(value: T) => Expectations<T>)

// Instrument a getter for negative matchers
Object.defineProperty(expect, 'not', {
  get: () => new ExpectationsMatcherImpl([]).not,
})

// Create a matcher for each expectation function
for (const name in expectationsFunctions) {
  Object.defineProperty(expect, name, {
    value: function(...args: any[]): ExpectationsMatcher {
      const builder = new ExpectationsMatcherImpl([])
      return (builder as any)[name](...args)
    },
  })
}
