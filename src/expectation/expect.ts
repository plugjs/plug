import { ExpectationError, type Constructor, type StringMatcher } from './types'
import {
  ToBeA,
  ToBeCloseTo,
  ToBeError,
  ToBeGreaterThan,
  ToBeGreaterThanOrEqual,
  ToBeInstanceOf,
  ToBeLessThan,
  ToBeLessThanOrEqual,
  ToBeWithinRange,
  ToHaveLength,
  ToHaveProperty,
  ToHaveSize,
  ToMatch,
  ToStrictlyEqual,
} from './basic'
import {
  ToThrow,
  ToThrowError,
} from './throwing'
import {
  ToBeDefined,
  ToBeFalse,
  ToBeFalsy,
  ToBeNaN,
  ToBeNegativeInfinity,
  ToBeNull,
  ToBePositiveInfinity,
  ToBeTrue,
  ToBeTruthy,
  ToBeUndefined,
} from './void'

/* ========================================================================== *
 * IMPORT AND PREPARE EXTERNAL EXPECTATIONS                                   *
 * ========================================================================== */

/** Singleton with all imported (known) expectations */
const expectations = {
  // basic expectations
  toBeA: new ToBeA(),
  toBeCloseTo: new ToBeCloseTo(),
  toBeError: new ToBeError(),
  toBeGreaterThan: new ToBeGreaterThan(),
  toBeGreaterThanOrEqual: new ToBeGreaterThanOrEqual(),
  toBeInstanceOf: new ToBeInstanceOf(),
  toBeLessThan: new ToBeLessThan(),
  toBeLessThanOrEqual: new ToBeLessThanOrEqual(),
  toBeWithinRange: new ToBeWithinRange(),
  toHaveLength: new ToHaveLength(),
  toHaveProperty: new ToHaveProperty(),
  toHaveSize: new ToHaveSize(),
  toMatch: new ToMatch(),
  toStrictlyEqual: new ToStrictlyEqual(),
  toThrow: new ToThrow(),
  toThrowError: new ToThrowError(),

  // void expectations
  toBeDefined: new ToBeDefined(),
  toBeFalse: new ToBeFalse(),
  toBeFalsy: new ToBeFalsy(),
  toBeNaN: new ToBeNaN(),
  toBeNegativeInfinity: new ToBeNegativeInfinity(),
  toBeNull: new ToBeNull(),
  toBePositiveInfinity: new ToBePositiveInfinity(),
  toBeTrue: new ToBeTrue(),
  toBeTruthy: new ToBeTruthy(),
  toBeUndefined: new ToBeUndefined(),
} as const

/** The type of our imported expectations */
type ExpectationsByName = typeof expectations

/** Infer expectations parameter from {@link Expectation} type */
type ExpectationParameters<E> =
  E extends Expectation ?
    Parameters<E['expect']> extends [ any, any, ...infer P ] ? P : never :
  never

/** Infer return parameter from {@link Expectation} type */
type ExpectationReturn<E, T> = E extends Expectation ? Expectations<T> : never

/** Infer expectation functions from imported {@link Expectation} instances */
type ImportedExpectations<T = unknown> = {
  [ k in keyof ExpectationsByName ]: (
    ...args: ExpectationParameters<ExpectationsByName[k]>
  ) => ExpectationReturn<ExpectationsByName[k], T>
}

/* ========================================================================== *
 * EXPECTATIONS DEFINITION                                                    *
 * ========================================================================== */

/** An interface describing all expectations returned by `expect(...)` */
export interface Expectations<T = unknown> extends ImportedExpectations<T> {
  /**
   * The parent of this instance, if and only if this is a child derived from
   * a property of the parent instance's value.
   */
  parent?: ExpectationsParent

  /** The value this {@link Expectations} instance operates on */
  value: T

  /** The _negated_ expectations of _this_ {@link Expectations} instance. */
  not: Expectations<T>

  /**
   * Programmatically return _positive_ or _negative_ {@link Expectations}
   * for the value wrapped by this instance.
   */
  negated(negative: boolean): Expectations<T>

  /** Create an {@link Expectations} associated with a property of this value */
  forProperty(prop: string | number | symbol): Expectations

  /** Create a new {@link Expectations} instance for the specified value */
  forValue<T = unknown>(value: T): Expectations<T>

  /* == ASYNCHRONOUS EXPECTATIONS =========================================== */

  /** Expect the value to be a _resolved_ {@link Promise} */
  toBeResolved(): Promise<ExpectationsImpl<T>>
  /**
   * Expect the value to be a _resolved_ {@link Promise}, and assert the
   * resolved result with the specified callback
   */
  toBeResolved(assert: (resultExpectations: Expectations) => void): Promise<ExpectationsImpl<T>>

  /** Expect the value to be a _rejected_ {@link Promise} */
  toBeRejected(): Promise<ExpectationsImpl<T>>
  /**
   * Expect the value to be a _rejected_ {@link Promise}, and assert the
   * rejected reason with the specified callback
   */
  toBeRejected(assert?: (rejectionExpectations: Expectations) => void): Promise<ExpectationsImpl<T>>

  /** Expect the value to be a {@link Promise} _rejected_ by an {@link Error} */
  toBeRejectedWithError(): Promise<Expectations<T>>
  /**
   * Expect the value to be a {@link Promise} _rejected_ by an {@link Error}
   * with the specified _message_
   */
  toBeRejectedWithError(message: StringMatcher): Promise<Expectations<T>>
  /**
   * Expect the value to be a {@link Promise} _rejected_ by an {@link Error}
   * of the specified _type_
   */
  toBeRejectedWithError(constructor: Constructor<Error>): Promise<Expectations<T>>
  /**
   * Expect the value to be a {@link Promise} _rejected_ by an {@link Error}
   * of the specified _type_ and with the specified _message_
   */
  toBeRejectedWithError(constructor: Constructor<Error>, message: StringMatcher): Promise<Expectations<T>>
}

/** Parent expectations */
export interface ExpectationsParent {
  context: Expectations,
  prop: string | number | symbol,
}


/** Basic definition of an {@link Expectation} as an object */
export interface Expectation {
  expect(context: Expectations, negative: boolean, ...args: any[]): void
}

/* ========================================================================== *
 * EXPECTATIONS IMPLEMENTATION                                                *
 * ========================================================================== */

/** Empty interface: the `class` below won't complain about missing stuff */
interface ExpectationsImpl<T = unknown> extends Expectations<T> {}

/** Implementation of our {@link Expectations} interface */
class ExpectationsImpl<T = unknown> implements Expectations<T> {
  private _positiveExpectations: ExpectationsImpl<T>
  private _negativeExpectations: ExpectationsImpl<T>
  private _negative: boolean

  constructor(
      public readonly value: T,
      _positiveExpectations?: ExpectationsImpl<T>,
  ) {
    if (_positiveExpectations) {
      this._negative = true
      this._positiveExpectations = _positiveExpectations
      this._negativeExpectations = this
    } else {
      this._negative = false
      this._positiveExpectations = this
      this._negativeExpectations = new ExpectationsImpl(value, this)
    }
  }

  /* == NEW EXPECTATIONS ==================================================== */

  forProperty(prop: string | number | symbol): ExpectationsImpl {
    this.toBeDefined()

    const child = new ExpectationsImpl((this.value as any)[prop])
    child.parent = { context: this, prop }
    return child
  }

  forValue<T = unknown>(value: T): ExpectationsImpl<T> {
    return new ExpectationsImpl(value)
  }

  /* == NEGATION ============================================================ */

  negated(negative: boolean): ExpectationsImpl<T> {
    return negative ? this._negativeExpectations : this._positiveExpectations
  }

  get not(): ExpectationsImpl<T> {
    return this._negative ? this._positiveExpectations : this._negativeExpectations
  }

  /* == ASYNCHRONOUS EXPECTATIONS =========================================== */

  toBeResolved(assert?: (resultExpectations: Expectations) => void): Promise<ExpectationsImpl<T>> {
    return Promise.resolve()
        .then(() => {
          this._positiveExpectations.toHaveProperty('then', (a) => a.toBeA('function'))
          return Promise.allSettled([ Promise.resolve(this.value) ])
        })
        .then(([ settlement ]) => {
          if (settlement.status === 'fulfilled') {
            if (this._negative) throw new ExpectationError(this, true, 'to be resolved')
            if (assert) assert(new ExpectationsImpl(settlement.value))
          } else if (! this._negative) {
            throw new ExpectationError(this, false, 'to be resolved')
          }

          return this._positiveExpectations
        })
  }

  toBeRejected(assert?: (reasonExpectations: Expectations) => void): Promise<ExpectationsImpl<T>> {
    return Promise.resolve()
        .then(() => {
          this._positiveExpectations.toHaveProperty('then', (a) => a.toBeA('function'))
          return Promise.allSettled([ Promise.resolve(this.value) ])
        })
        .then(([ settlement ]) => {
          if (settlement.status === 'rejected') {
            if (this._negative) throw new ExpectationError(this, true, 'to be rejected')
            if (assert) assert(new ExpectationsImpl(settlement.reason))
          } else if (! this._negative) {
            throw new ExpectationError(this, false, 'to be rejected')
          }

          return this._positiveExpectations
        })
  }

  toBeRejectedWithError(
      ...args:
      | []
      | [ message: StringMatcher ]
      | [ constructor: Constructor<Error> ]
      | [ constructor: Constructor<Error>, message: StringMatcher ]
  ): Promise<ExpectationsImpl<T>> {
    return this.toBeRejected((assert) => assert.toBeError(...args))
  }

  /* == STATIC INITALIZER =================================================== */

  static {
    for (const [ key, value ] of Object.entries(expectations)) {
      const expectation = value as Expectation
      Object.defineProperty(this.prototype, key, {
        value: function(this: ExpectationsImpl, ...args: any[]): any {
          expectation.expect(this._positiveExpectations, this._negative, ...args)
          return this._positiveExpectations
        },
      })
    }
  }
}

/* ========================================================================== *
 * EXPECT FUNCTION                                                            *
 * ========================================================================== */

/** Return an {@link Expectation} chain for the specified value */
export function expect<T = unknown>(value: T): Expectations<T> {
  return new ExpectationsImpl(value)
}
