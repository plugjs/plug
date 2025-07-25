import { diff } from './diff'
import { toInclude, toMatchContents } from './include'
import {
  ExpectationError,
  isMatcher,
  prefixType,
  stringifyConstructor,
  stringifyValue,
  typeOf,
} from './types'

import type { Diff } from './diff'
import type { Matcher } from './matchers'
import type {
  Constructor,
  TypeMappings,
  TypeName,
} from './types'

/* ========================================================================== *
 * TYPES SUPPORTING EXPECTATIONS                                              *
 * ========================================================================== */

/** An assertion function, for sub-expectations and value introspection */
export type AssertionFunction<T = unknown> = (assert: Expectations<T>) => void | Expectations

/** Return the type asserted by an {@link AssertionFunction} or `T` */
export type AssertedType<T, F extends AssertionFunction<any>, R = ReturnType<F>> =
  R extends Expectations<infer I> ?
    unknown extends I ?
      T : // returns Expectations<unknown>, use T
      I : // returns Expectations<something>, use "something"
    T // returns something else (void), use T

/** Infer the type of a {@link Matcher}  */
export type InferMatcher<T, M extends Matcher> =
  M extends Matcher<infer I> ?
    unknown extends I ? T : T & I :
    never

/** Recursively infer the type of a {@link Matcher} in a `Record`  */
export type InferToEqual<T> =
  T extends Matcher<infer V> ? V :
    T extends Record<any, any> ? { [ k in keyof T ] : InferToEqual<T[k]> } :
      T

/** Simple wrapper defining the _parent_ instance of an {@link Expectations}. */
export type ExpectationsParent = {
  /** Parent {@link Expectations} instance */
  expectations: Expectations,
  /** Property associating _this_ to the parent */
  prop: string | number | symbol,
}

/* ========================================================================== *
 * EXPECTATIONS                                                               *
 * ========================================================================== */

/** Main class containing all supported expectations */
export class Expectations<T = unknown> {
  /** The {@link NegativeExpectations} associated with _this_ */
  readonly not: NegativeExpectations<T>

  /**
   * Create an {@link Expectations} instance associated with the specified
   * value and error remarks.
   *
   * Optionally a parent {@link Expectations} instance can be specified.
   */
  constructor(
      /** The value associated with this instance */
      readonly value: T,
      /** Optional additional _remarks_ to associate with errors */
      readonly remarks: string | undefined, // required, but migth be undefined
      /**
       * An optional {@link ExpectationsParent} defining _this_ to be a
       * child of another {@link Expectations} instance
       */
      readonly parent?: ExpectationsParent,
  ) {
    this.not = new NegativeExpectations(this)
  }

  /** Throw an {@link ExpectationError} associated with _this_ */
  protected _fail(details: string, diff?: Diff): never {
    const error = new ExpectationError(this, details, diff)
    Error.captureStackTrace(error, this._fail)
    throw error
  }

  /* ------------------------------------------------------------------------ *
   * BASIC                                                                    *
   * ------------------------------------------------------------------------ */

  /**
   * Expects the value to be of the specified _extended_ {@link TypeName type}.
   *
   * Negation: {@link NegativeExpectations.toBeA `not.toBeA(...)`}
   */
  toBeA<Name extends TypeName>(type: Name): Expectations<TypeMappings[Name]>

  /**
   * Expects the value to be of the specified _extended_ {@link TypeName type},
   * and further validates it with a {@link Matcher}.
   *
   * Negation: {@link NegativeExpectations.toBeA `not.toBeA(...)`}
   */
  toBeA<
    Name extends TypeName,
    Mapped extends TypeMappings[Name],
    Match extends Matcher,
  >(
    type: Name,
    matcher: Match,
  ): Expectations<InferMatcher<Mapped, Match>>

  /**
   * Expects the value to be of the specified _extended_ {@link TypeName type},
   * and further asserts it with an {@link AssertionFunction}.
   *
   * Negation: {@link NegativeExpectations.toBeA `not.toBeA(...)`}
   */
  toBeA<
    Name extends TypeName,
    Mapped extends TypeMappings[Name],
    Assert extends AssertionFunction<Mapped>,
  >(
    type: Name,
    assertion: Assert,
  ): Expectations<AssertedType<Mapped, Assert>>

  toBeA(
      type: TypeName,
      assertionOrMatcher?: AssertionFunction | Matcher,
  ): Expectations {
    if (typeOf(this.value) === type) {
      if (isMatcher(assertionOrMatcher)) {
        assertionOrMatcher.expect(this.value)
      } else if (assertionOrMatcher) {
        assertionOrMatcher(this as Expectations<any>)
      }
      return this as Expectations<any>
    }

    this._fail(`to be ${prefixType(type)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `Date`, a `string` parseable into a `Date`, or a
   * `number` indicating the milliseconds from the epoch, _strictly after_
   * the specified date.
   *
   * Negation: {@link Expectations.toBeBeforeOrEqual `toBeBeforeOrEqual(...)`}
   */
  toBeAfter(value: Date | number | string, deltaMs?: number): Expectations<T> {
    const after =
      value instanceof Date ? value.getTime() :
      typeof value === 'number' ? value : new Date(value).getTime()

    const timestamp =
      this.value instanceof Date ? this.value.getTime() :
      typeof this.value === 'string' ? new Date(this.value).getTime() :
      typeof this.value === 'number' ? this.value :
      undefined

    if (typeof timestamp !== 'number') {
      this._fail(`to be a string, a number or an instance of ${stringifyConstructor(Date)}`)
    } else if (isNaN(timestamp)) {
      this._fail('to be a valid date')
    }

    if (timestamp <= after) {
      this._fail(`to be after ${stringifyValue(new Date(after))}`)
    }

    if (deltaMs !== undefined) return this.toBeBefore(after + deltaMs + 1)
    return this
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `Date`, a `string` parseable into a `Date`, or a
   * `number` indicating the milliseconds from the epoch, _after or equal_
   * the specified date.
   *
   * Negation: {@link Expectations.toBeBefore `toBeBefore(...)`}
   */
  toBeAfterOrEqual(value: Date | number | string, deltaMs?: number): Expectations<T> {
    const after =
      value instanceof Date ? value.getTime() :
      typeof value === 'number' ? value : new Date(value).getTime()
    const delta = deltaMs === undefined ? undefined : deltaMs + 1
    return this.toBeAfter(after - 1, delta)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `Date`, a `string` parseable into a `Date`, or a
   * `number` indicating the milliseconds from the epoch, _strictly before_
   * the specified date.
   *
   * Negation: {@link Expectations.toBeAfterOrEqual `toBeAfterOrEqual(...)`}
   */
  toBeBefore(value: Date | number | string, deltaMs?: number): Expectations<T> {
    const before =
      value instanceof Date ? value.getTime() :
      typeof value === 'number' ? value : new Date(value).getTime()

    const timestamp =
      this.value instanceof Date ? this.value.getTime() :
      typeof this.value === 'string' ? new Date(this.value).getTime() :
      typeof this.value === 'number' ? this.value :
      undefined

    if (typeof timestamp !== 'number') {
      this._fail(`to be a string, a number or an instance of ${stringifyConstructor(Date)}`)
    } else if (isNaN(timestamp)) {
      this._fail('to be a valid date')
    }

    if (timestamp >= before) {
      this._fail(`to be before ${stringifyValue(new Date(before))}`)
    }

    if (deltaMs !== undefined) return this.toBeAfter(before - deltaMs - 1)
    return this
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `Date`, a `string` parseable into a `Date`, or a
   * `number` indicating the milliseconds from the epoch, _before or equal_
   * the specified date.
   *
   * Negation: {@link Expectations.toBeAfter `toBeAfter(...)`}
   */
  toBeBeforeOrEqual(value: Date | number | string, deltaMs?: number): Expectations<T> {
    const before =
      value instanceof Date ? value.getTime() :
      typeof value === 'number' ? value : new Date(value).getTime()
    const delta = deltaMs === undefined ? undefined : deltaMs + 1
    return this.toBeBefore(before + 1, delta)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` within a given +/- _delta_ range of the
   * specified expected value.
   *
   * Negation: {@link NegativeExpectations.toBeCloseTo `not.toBeCloseTo(...)`}
   */
  toBeCloseTo(value: number, delta: number): Expectations<number>

  /**
   * Expects the value to be a `bigint` within a given +/- _delta_ range of the
   * specified expected value.
   *
   * Negation: {@link NegativeExpectations.toBeCloseTo `not.toBeCloseTo(...)`}
   */
  toBeCloseTo(value: bigint, delta: bigint): Expectations<bigint>

  toBeCloseTo(value: number | bigint, delta: number | bigint): Expectations {
    const min = (value as number) - (delta as number)
    const max = (value as number) + (delta as number)
    return this.toBeWithinRange(min, max)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be neither `null` nor `undefined`.
   *
   * Negation: {@link NegativeExpectations.toBeDefined `not.toBeDefined()`}
   */
  toBeDefined(): Expectations<T> {
    if ((this.value !== null) && (this.value !== undefined)) return this
    this._fail(`to be neither ${stringifyValue(null)} nor ${stringifyValue(undefined)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expect the value to be an instance of {@link Error}.
   *
   * If specified, the {@link Error}'s own message will be further expected to
   * either match the specified {@link RegExp}, or equal the specified `string`.
   */
  toBeError(
    message?: string | RegExp
  ): Expectations<Error>

  /**
   * Expect the value to be an instance of {@link Error} and further asserts
   * it to be an instance of the specifed {@link Error} {@link Constructor}.
   *
   * If specified, the {@link Error}'s own message will be further expected to
   * either match the specified {@link RegExp}, or equal the specified `string`.
   */
  toBeError<Class extends Constructor<Error>>(
    constructor: Class,
    message?: string | RegExp,
  ): Expectations<InstanceType<Class>>

  toBeError(
      constructorOrMessage?: string | RegExp | Constructor,
      maybeMessage?: string | RegExp,
  ): Expectations {
    const [ constructor, message ] =
    typeof constructorOrMessage === 'function' ?
      [ constructorOrMessage, maybeMessage ] :
      [ Error, constructorOrMessage ]

    if (message === undefined) return this.toBeInstanceOf(constructor)

    return this.toBeInstanceOf(constructor, (assert) => {
      assert.toHaveProperty('message', (assertMessage) => {
        assertMessage.toBeA('string')
        if (typeof message === 'string') assertMessage.toStrictlyEqual(message)
        else assertMessage.toMatch(message)
      })
    })
  }

  /* ------------------------------------------------------------------------ */

  /** Expects the value strictly equal to `false`. */
  toBeFalse(): Expectations<false> {
    return this.toStrictlyEqual(false)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be _falsy_ (zero, empty string, `false`, ...).
   *
   * Negation: {@link Expectations.toBeTruthy `toBeTruthy()`}
   */
  toBeFalsy(): Expectations<T> {
    if (! this.value) return this
    this._fail('to be falsy')
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` greater than the specified expected
   * value.
   *
   * Negation: {@link Expectations.toBeLessThanOrEqual `toBeLessThanOrEqual(...)`}
   */
  toBeGreaterThan(value: number): Expectations<number>

  /**
   * Expects the value to be a `bigint` greater than the specified expected
   * value.
   *
   * Negation: {@link Expectations.toBeLessThanOrEqual `toBeLessThanOrEqual(...)`}
   */
  toBeGreaterThan(value: bigint): Expectations<bigint>

  toBeGreaterThan(value: number | bigint): Expectations {
    this.toBeA(typeof value)
    if ((this.value as any) > value) return this
    this._fail(`to be greater than ${stringifyValue(value)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number`  greater than or equal to the specified
   * expected value.
   *
   * Negation: {@link Expectations.toBeLessThan `toBeLessThan(...)`}
   */
  toBeGreaterThanOrEqual(value: number): Expectations<number>

  /**
   * Expects the value to be a `bigint` greater than or equal to the specified
   * expected value.
   *
   * Negation: {@link Expectations.toBeLessThan `toBeLessThan(...)`}
   */
  toBeGreaterThanOrEqual(value: bigint): Expectations<bigint>

  toBeGreaterThanOrEqual(value: number | bigint): Expectations {
    this.toBeA(typeof value)
    if ((this.value as any) >= value) return this
    this._fail(`to be greater than or equal to ${stringifyValue(value)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be an instance of the specified {@link Constructor}.
   *
   * Negation: {@link NegativeExpectations.toBeInstanceOf `not.toInstanceOf(...)`}
   */
  toBeInstanceOf<Class extends Constructor>(
    constructor: Class,
  ): Expectations<InstanceType<Class>>

  /**
   * Expects the value to be an instance of the specified {@link Constructor},
   * and further validates it with a {@link Matcher}.
   *
   * Negation: {@link NegativeExpectations.toBeInstanceOf `not.toInstanceOf(...)`}
   */
  toBeInstanceOf<
    Class extends Constructor,
    Match extends Matcher,
  >(
    constructor: Class,
    matcher: Match,
  ): Expectations<InferMatcher<InstanceType<Class>, Match>>

  /**
   * Expects the value to be an instance of the specified {@link Constructor},
   * and further asserts it with an {@link AssertionFunction}.
   *
   * Negation: {@link NegativeExpectations.toBeInstanceOf `not.toInstanceOf(...)`}
   */
  toBeInstanceOf<
    Class extends Constructor,
    Assert extends AssertionFunction<InstanceType<Class>>,
  >(
    constructor: Class,
    assertion: Assert,
  ): Expectations<AssertedType<InstanceType<Class>, Assert>>

  toBeInstanceOf(
      constructor: Constructor,
      assertionOrMatcher?: AssertionFunction | Matcher,
  ): Expectations {
    if (this.value instanceof constructor) {
      if (isMatcher(assertionOrMatcher)) {
        assertionOrMatcher.expect(this.value)
      } else if (assertionOrMatcher) {
        assertionOrMatcher(this as Expectations<any>)
      }
      return this as Expectations<any>
    }

    this._fail(`to be an instance of ${stringifyConstructor(constructor)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` less than the specified expected value.
   *
   * Negation: {@link Expectations.toBeGreaterThanOrEqual `toBeGreaterThanOrEqual(...)`}
   */
  toBeLessThan(value: number): Expectations<number>

  /**
   * Expects the value to be a `bigint` less than the specified expected value.
   *
   * Negation: {@link Expectations.toBeGreaterThanOrEqual `toBeGreaterThanOrEqual(...)`}
   */
  toBeLessThan(value: bigint): Expectations<bigint>

  toBeLessThan(value: number | bigint): Expectations {
    this.toBeA(typeof value)
    if ((this.value as any) < value) return this
    this._fail(`to be less than ${stringifyValue(value)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` less than or equal to the specified
   * expected value.
   *
   * Negation: {@link Expectations.toBeGreaterThan `toBeGreaterThan(...)`}
   */
  toBeLessThanOrEqual(value: number): Expectations<number>

  /**
   * Expects the value to be a `bigint` less than or equal to the specified
   * expected value.
   *
   * Negation: {@link Expectations.toBeGreaterThan `toBeGreaterThan(...)`}
   */
  toBeLessThanOrEqual(value: bigint): Expectations<bigint>

  toBeLessThanOrEqual(value: number | bigint): Expectations {
    this.toBeA(typeof value)
    if ((this.value as any) <= value) return this
    this._fail(`to be less than or equal to ${stringifyValue(value)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be `NaN`.
   *
   * Negation: {@link NegativeExpectations.toBeNaN `not.toBeNaN()`}
   */
  toBeNaN(): Expectations<number> {
    const expectations = this.toBeA('number')
    if (isNaN(expectations.value)) return expectations
    this._fail(`to be ${stringifyValue(NaN)}`)
  }

  /* ------------------------------------------------------------------------ */

  /** Expects the value to strictly equal `null`. */
  toBeNull(): Expectations<null> {
    return this.toStrictlyEqual(null)
  }

  /* ------------------------------------------------------------------------ */

  /** Expects the value to strictly equal `true`. */
  toBeTrue(): Expectations<true> {
    return this.toStrictlyEqual(true)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be _falsy_ (non-zero, non-empty string, ...).
   *
   * Negation: {@link Expectations.toBeFalsy `toBeFalsy()`}
   */
  toBeTruthy(): Expectations<T> {
    if (this.value) return this
    this._fail('to be truthy')
  }

  /* ------------------------------------------------------------------------ */

  /** Expects the value to strictly equal `undefined`. */
  toBeUndefined(): Expectations<undefined> {
    return this.toStrictlyEqual(undefined)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` within the specified range where the
   * minimum and maximum values are inclusive.
   *
   * Negation: {@link NegativeExpectations.toBeWithinRange `not.toBeWithinRange(...)`}
   */
  toBeWithinRange(min: number, max: number): Expectations<number>

  /**
   * Expects the value to be a `bigint` within the specified range where the
   * minimum and maximum values are inclusive.
   *
   * Negation: {@link NegativeExpectations.toBeWithinRange `not.toBeWithinRange(...)`}
   */
  toBeWithinRange(min: bigint, max: bigint): Expectations<bigint>

  toBeWithinRange(min: number | bigint, max: number | bigint): Expectations {
    if (max < min) {
      const num = max
      max = min
      min = num
    }

    this.toBeA(typeof min)

    if (((this.value as any) < min) || ((this.value as any) > max)) {
      this._fail(`to be within ${stringifyValue(min)}...${stringifyValue(max)}`)
    }

    return this
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be _deep equal to_ the specified expected one.
   *
   * When `strict` is `true` (defaults to `false`) enumerable keys associated
   * with an `undefined` value found in the _actual_ object will have to be
   * also defined in the _expected_ object.
   *
   * For example:
   *
   * ```ts
   * // non-strict mode
   * expect({ foo: undefined }).toEqual({}) // will pass
   * expect({}).toEqual({ foo: undefined }) // will pass
   * expect({ foo: undefined }).toEqual({ foo: undefined }) // will pass
   *
   * // strict mode
   * expect({ foo: undefined }).toEqual({}, true) // will fail
   * expect({}).toEqual({ foo: undefined }, true) // will fail
   * expect({}).toEqual({ foo: undefined }) // will fail ("foo" is missing, whether "strict" is true or false)
   * ```
   *
   * Negation: {@link NegativeExpectations.toEqual `not.toEqual(...)`}
   */
  toEqual<Type>(expected: Type, strict: boolean = false): Expectations<InferToEqual<Type>> {
    if ((this.value as any) === expected) return this as Expectations<any>

    const result = diff(this.value, expected, strict)

    if (result.diff) {
      if (isMatcher(expected)) {
        this._fail('to satisfy expectation matcher', result)
      } else {
        this._fail(`to equal ${stringifyValue(expected)}`, result)
      }
    } else {
      return this as Expectations<any>
    }
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to have a `number` _property_ `length` with the specified
   * expected value.
   *
   * Negation: {@link NegativeExpectations.toHaveLength `not.toHaveLength(...)`}
   */
  toHaveLength(length: number): Expectations<T & { length: number }> {
    this.toBeDefined()

    const realLength = (this.value as any)['length']
    if (typeof realLength !== 'number') {
      this._fail('to have a numeric "length" property')
    } else if (realLength !== length) {
      this._fail(`to have length ${length}`)
    }

    return this as Expectations<any>
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to have the specified _property_.
   *
   * The value associated with the property should not be `undefined`.
   *
   * For example:
   *
   * ```ts
   * expect({}).toHaveProperty('foo') // fails
   * expect({ foo: undefined }).toHaveProperty('foo') // fails
   * ```
   *
   * Negation: {@link NegativeExpectations.toHaveProperty `not.toHaveProperty(...)`}
   */
  toHaveProperty<Prop extends string | number | symbol>(
    property: Prop,
  ): Expectations<T & { [keyt in Prop] : unknown }>

  /**
   * Expects the value to have the specified _property_ and (if found)
   * further validates its value with a {@link Matcher}.
   *
   * This also works with `undefined` values, for example:
   * ```ts
   * expect({ foo: undefined }).toHaveProperty('foo') // no matcher, fails
   * expect({ foo: undefined }).toHaveProperty('foo', expect.toBeUndefined()) // works!
   * ```
   *
   * Negation: {@link NegativeExpectations.toHaveProperty `not.toHaveProperty(...)`}
   */
  toHaveProperty<
    Prop extends string | number | symbol,
    Match extends Matcher,
  >(
    property: Prop,
    matcher: Match,
  ): Expectations<T & { [keyt in Prop] : InferMatcher<unknown, Match> }>

  /**
   * Expects the value to have the specified _property_ and (if specified)
   * further asserts its value with an {@link AssertionFunction}.
   *
   * Negation: {@link NegativeExpectations.toHaveProperty `not.toHaveProperty(...)`}
   */
  toHaveProperty<
    Prop extends string | number | symbol,
    Assert extends AssertionFunction,
  >(
    property: Prop,
    assertion: Assert,
  ): Expectations<T & { [keyt in Prop] : AssertedType<unknown, Assert> }>

  toHaveProperty(
      property: string | number | symbol,
      assertionOrMatcher?: AssertionFunction | Matcher,
  ): Expectations {
    this.toBeDefined()

    const propertyValue = (this.value as any)[property]
    let hasProperty: boolean
    try {
      // this is for "normal" objects
      hasProperty = property in (this.value as any)
    } catch {
      // when "in" doesn't apply (primitives) use the value
      hasProperty = propertyValue !== undefined
    }

    if (! hasProperty) {
      this._fail(`to have property "${String(property)}"`)
    }

    if (assertionOrMatcher) {
      const parent: ExpectationsParent = { expectations: this, prop: property }
      try {
        if (isMatcher(assertionOrMatcher)) {
          assertionOrMatcher.expect(propertyValue, parent)
        } else if (assertionOrMatcher) {
          const expectations = new Expectations(propertyValue, this.remarks, parent)
          assertionOrMatcher(expectations)
        }
      } catch (error) {
        // any caught error difference gets remapped as a property diff
        if ((error instanceof ExpectationError) && (error.diff)) {
          error.diff = {
            diff: true,
            value: this.value,
            props: { [property]: error.diff },
          }
        }

        // re-throw
        throw error
      }
    } else if (propertyValue === undefined) {
      this._fail(`has property "${String(property)}" with value ${stringifyValue(undefined)}`)
    }

    return this as Expectations<any>
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to have a `number` _property_ `size` with the specified
   * expected value.
   *
   * Negation: {@link NegativeExpectations.toHaveSize `not.toHaveSize(...)`}
   */
  toHaveSize(size: number): Expectations<T & { size: number }> {
    this.toBeDefined()

    const realSize = (this.value as any)['size']
    if (typeof realSize !== 'number') {
      this._fail('to have a numeric "size" property')
    } else if (realSize !== size) {
      this._fail(`to have size ${size}`)
    }

    return this as Expectations<any>
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expect the value to include _all_ properties from the specified _object_.
   *
   * If the object being expected is a {@link Map}, the properties specified
   * here will be treated as _mappings_ for said {@link Map}.
   *
   * Negation: {@link NegativeExpectations.toInclude `not.toInclude(...)`}
   */
  toInclude<P extends Record<string, any>>(properties: P): Expectations<T>

  /**
   * Expect the value to include _all_ mappings from the specified {@link Map}.
   *
   * Negation: {@link NegativeExpectations.toInclude `not.toInclude(...)`}
   */
  toInclude(mappings: Map<any, any>): Expectations<T>

  /**
   * Expect the value to be an {@link Iterable} object includind _all_ values
   * from the specified {@link Set}, in any order.
   *
   * Negation: {@link NegativeExpectations.toInclude `not.toInclude(...)`}
   */
  toInclude(entries: Set<any>): Expectations<T>

  /**
   * Expect the value to be an {@link Iterable} object includind _all_ values
   * from the specified _array_, in any order.
   *
   * Negation: {@link NegativeExpectations.toInclude `not.toInclude(...)`}
   */
  toInclude(values: any[]): Expectations<T>

  toInclude(
      contents: Record<string, any> | Map<any, any> | Set<any> | any[],
  ): Expectations {
    toInclude(this, false, contents)
    return this
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `string` _matching_ the specified sub-`string`
   * or {@link RegExp}.
   *
   * Negation: {@link NegativeExpectations.toMatch `not.toMatch(...)`}
   */
  toMatch<Matcher extends string | RegExp>(
      matcher: Matcher,
  ): Expectations<string> {
    const expectations = this.toBeA('string')

    if (expectations.value.match(matcher)) return expectations

    this._fail(`to match ${stringifyValue(matcher)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expect the value to be an {@link Iterable} object includind _all_ values
   * (and only those values) from the specified _array_ or {@link Set},
   * in any order.
   */
  toMatchContents(contents: any[] | Set<any>): Expectations<T> {
    toMatchContents(this, contents)
    return this
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be _strictly equal to_ the specified expected one.
   *
   * Negation: {@link NegativeExpectations.toStrictlyEqual `not.toStrictlyEqual(...)`}
   */
  toStrictlyEqual<Type>(expected: Type): Expectations<Type> {
    if ((this.value as any) === expected) return this as Expectations<any>

    const diff = { diff: true, value: this.value, expected }
    this._fail(`to strictly equal ${stringifyValue(expected)}`, diff)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `function` throwing.
   *
   * Negation: {@link NegativeExpectations.toThrow `not.toThrow()`}
   */
  toThrow(): Expectations<() => any>

  /**
   * Expects the value to be a `function` throwing, and further validates the
   * thrown value with a {@link Matcher}.
   *
   * Negation: {@link NegativeExpectations.toThrow `not.toThrow()`}
   */
  toThrow(matcher: Matcher): Expectations<() => any>

  /**
   * Expects the value to be a `function` throwing, and further asserts the
   * thrown value with an {@link AssertionFunction}.
   *
   * Negation: {@link NegativeExpectations.toThrow `not.toThrow()`}
   */
  toThrow(assert: AssertionFunction): Expectations<() => any>

  toThrow(
      assertionOrMatcher?: AssertionFunction | Matcher,
  ): Expectations<() => any> {
    const func = this.toBeA('function')

    let passed = false
    try {
      func.value()
      passed = true
    } catch (thrown) {
      if (isMatcher(assertionOrMatcher)) {
        assertionOrMatcher.expect(thrown)
      } else if (assertionOrMatcher) {
        assertionOrMatcher(new Expectations(thrown, this.remarks))
      }
    }

    if (passed) this._fail('to throw')
    return this as Expectations<any>
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `function` throwing an {@link Error}.
   *
   * If specified, the {@link Error}'s own message will be further expected to
   * either match the specified {@link RegExp}, or equal to the specified
   * `string`.
   *
   * Negation: {@link NegativeExpectations.toThrow `not.toThrow()`}
   */
  toThrowError(
    message?: string | RegExp
  ): Expectations<() => any>

  /**
   * Expects the value to be a `function` throwing an instance of the
   * {@link Error} identified by the specified {@link Constructor}.
   *
   * If specified, the {@link Error}'s own message will be further expected to
   * either match the specified {@link RegExp}, or equal to the specified
   * `string`.
   *
   * Negation: {@link NegativeExpectations.toThrow `not.toThrow()`}
   */
  toThrowError<Class extends Constructor<Error>>(
    constructor: Class,
    message?: string | RegExp,
  ): Expectations<() => any>

  toThrowError(
      constructorOrMessage?: string | RegExp | Constructor,
      maybeMessage?: string | RegExp,
  ): Expectations {
    const [ constructor, message ] =
     typeof constructorOrMessage === 'function' ?
       [ constructorOrMessage, maybeMessage ] :
       [ Error, constructorOrMessage ]

    return this.toThrow((assert) =>
      assert.toBeError(constructor, message))
  }
}

/* ========================================================================== *
 * NEGATIVE EXPECTATIONS                                                      *
 * ========================================================================== */

/** Negative expectations, as a subset of (meaningful) expectations. */
export class NegativeExpectations<T = unknown> {
  /** For convenience, the value associated with the {@link Expectations} */
  private readonly _value: T

  /**
   * Create a {@link NegativeExpectations} instance associated with the
   * specified (positive) {@link Expectations}.
   */
  constructor(
      /** The {@link Expectations} instance associated with this one */
      private readonly _expectations: Expectations<T>,
  ) {
    this._value = _expectations.value
  }

  /** Throw an {@link ExpectationError} associated with _this_ */
  private _fail(details: string, diff?: Diff): never {
    throw new ExpectationError(this._expectations, details, diff)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value _**NOT**_ to be of the specified _extended_
   * {@link TypeName type}.
   *
   * Negates: {@link Expectations.toBeA `toBeA(...)`}
   */
  toBeA(type: TypeName): Expectations<T> {
    if (typeOf(this._value) !== type) return this._expectations
    this._fail(`not to be ${prefixType(type)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` _**OUTSIDE**_ of the given +/- _delta_
   * range of the specified expected value.
   *
   * Negates: {@link Expectations.toBeCloseTo `toBeCloseTo(...)`}
   */
  toBeCloseTo(value: number, delta: number): Expectations<number>

  /**
   * Expects the value to be a `bigint` _**OUTSIDE**_ of the given +/- _delta_
   * range of the specified expected value.
   *
   * Negates: {@link Expectations.toBeCloseTo `toBeCloseTo(...)`}
   */
  toBeCloseTo(value: bigint, delta: bigint): Expectations<bigint>

  toBeCloseTo(value: number | bigint, delta: number | bigint): Expectations {
    const min = (value as number) - (delta as number)
    const max = (value as number) + (delta as number)
    return this.toBeWithinRange(min, max)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be either `null` or `undefined`.
   *
   * Negates: {@link Expectations.toBeDefined `toBeDefined()`}
   */
  toBeDefined(): Expectations<null | undefined> {
    if ((this._value === null) || (this._value === undefined)) {
      return this._expectations as Expectations<any>
    }

    this._fail(`to be ${stringifyValue(null)} or ${stringifyValue(undefined)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value _**NOT**_ to be an instance of the specified
   * {@link Constructor}.
   *
   * Negates: {@link Expectations.toBeInstanceOf `toBeInstanceOf(...)`}
   */
  toBeInstanceOf(constructor: Constructor): Expectations<T> {
    if (this._value instanceof constructor) {
      this._fail(`not to be an instance of ${stringifyConstructor(constructor)}`)
    }
    return this._expectations
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value _**NOT**_ to be `NaN`.
   *
   * Negates: {@link Expectations.toBeNaN `toBeNaN()`}
   */
  toBeNaN(): Expectations<number> {
    const expectations = this._expectations.toBeA('number')
    if (isNaN(expectations.value)) this._fail(`not to be ${stringifyValue(NaN)}`)
    return expectations
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` _**OUTSIDE**_ of the specified range
   * where minimum and maximum values are inclusive.
   *
   * Negates: {@link Expectations.toBeWithinRange `toBeWithinRange(...)`}
   */
  toBeWithinRange(min: number, max: number): Expectations<number>

  /**
   * Expects the value to be a `bigint` _**OUTSIDE**_ of the specified range
   * where minimum and maximum values are inclusive.
   *
   * Negates: {@link Expectations.toBeWithinRange `toBeWithinRange(...)`}
   */
  toBeWithinRange(min: bigint, max: bigint): Expectations<bigint>

  toBeWithinRange(min: number | bigint, max: number | bigint): Expectations {
    if (max < min) {
      const num = max
      max = min
      min = num
    }

    this._expectations.toBeA(typeof min)

    if (((this._value as any) >= min) && ((this._value as any) <= max)) {
      this._fail(`not to be within ${stringifyValue(min)}...${stringifyValue(max)}`)
    }

    return this._expectations
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value _**NOT**_ to be _deep equal to_ the specified expected
   * one.
   *
   * Negates: {@link Expectations.toEqual `toEqual(...)`}
   */
  toEqual(expected: any, strict: boolean = false): Expectations<T> {
    let result: Diff = { diff: false, value: this._value }
    if (this._value !== expected) {
      result = diff(this._value, expected, strict)
      if (result.diff) return this._expectations
    }

    if (isMatcher(expected)) {
      this._fail('not to satisfy expectation matcher', result)
    } else {
      this._fail(`not to equal ${stringifyValue(expected)}`, result)
    }
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to have a `number` _property_ `length` _different_ from
   * the specified expected value.
   *
   * Negates: {@link Expectations.toHaveLength `toHaveLength(...)`}
   */
  toHaveLength(length: number): Expectations<T & { length: number }> {
    this._expectations.toBeDefined()

    const realLength = (this._value as any)['length']
    if (typeof realLength !== 'number') {
      this._fail('to have a numeric "length" property')
    } else if (realLength === length) {
      this._fail(`not to have length ${length}`)
    }

    return this._expectations as Expectations<any>
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value _**NOT**_ to have the specified _property_.
   *
   * Negates: {@link Expectations.toHaveProperty `toHaveProperty(...)`}
   */
  toHaveProperty(property: string | number | symbol): Expectations<T> {
    this._expectations.toBeDefined()

    let hasProperty: boolean
    try {
      hasProperty = property in (this._value as any)
    } catch {
      hasProperty = (this._value as any)[property] !== undefined
    }

    if (hasProperty) this._fail(`not to have property "${String(property)}"`)
    return this._expectations
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to have a `number` _property_ `size` _different_ from
   * the specified expected value.
   *
   * Negates: {@link Expectations.toHaveSize `toHaveSize(...)`}
   */
  toHaveSize(size: number): Expectations<T & { size: number }> {
    this._expectations.toBeDefined()

    const realSize = (this._value as any)['size']
    if (typeof realSize !== 'number') {
      this._fail('to have a numeric "size" property')
    } else if (realSize === size) {
      this._fail(`not to have size ${size}`)
    }

    return this._expectations as Expectations<any>
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expect the value to include _none_ of the properties from the specified
   * _object_.
   *
   * If the object being expected is a {@link Map}, the properties specified
   * here will be treated as _mappings_ for said {@link Map}.
   *
   * Negates: {@link Expectations.toInclude `toInclude(...)`}
   */
  toInclude<P extends Record<string, any>>(properties: P): Expectations<T>

  /**
   * Expect the value to include _none_ of the mappings from the specified
   * {@link Map}.
   *
   * Negates: {@link Expectations.toInclude `toInclude(...)`}
   */
  toInclude(mappings: Map<any, any>): Expectations<T>

  /**
   * Expect the value to be an {@link Iterable} object includind _none_ of the
   * values from the specified {@link Set}.
   *
   * Negates: {@link Expectations.toInclude `toInclude(...)`}
   */
  toInclude(entries: Set<any>): Expectations<T>

  /**
   * Expect the value to be an {@link Iterable} object includind _none_ of the
   * values from the specified _array_.
   *
   * Negates: {@link Expectations.toInclude `toInclude(...)`}
   */
  toInclude(values: any[]): Expectations<T>

  toInclude(
      contents: Record<string, any> | Map<any, any> | Set<any> | any[],
  ): Expectations {
    toInclude(this._expectations, true, contents)
    return this._expectations
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `string` _**NOT MATCHING**_ the specified
   * sub-`string` or {@link RegExp}.
   *
   * Negates: {@link Expectations.toMatch `toMatch(...)`}
   */
  toMatch(matcher: string | RegExp): Expectations<string> {
    const expectations = this._expectations.toBeA('string')

    if (! expectations.value.match(matcher)) return expectations

    this._fail(`not to match ${stringifyValue(matcher)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `function` not throwing anything.
   *
   * Negates: {@link Expectations.toThrow `toThrow(...)`}
   */
  toThrow(): Expectations<() => any> {
    const expectations = this._expectations.toBeA('function')

    try {
      expectations.value()
      return expectations
    } catch {
      this._fail('not to throw')
    }
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value _**NOT**_ to be _strictly equal to_ the specified
   * expected one.
   *
   * Negates: {@link Expectations.toStrictlyEqual `toStrictlyEqual(...)`}
   */
  toStrictlyEqual(expected: any): Expectations<T> {
    if (this._value !== expected) return this._expectations
    this._fail(`not to strictly equal ${stringifyValue(expected)}`)
  }
}
