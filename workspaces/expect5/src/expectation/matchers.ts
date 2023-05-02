import {
  Expectations,
  type AssertedType,
  type AssertionFunction,
  type NegativeExpectations,
  type InferMatchers,
} from './expectations'
import {
  matcherMarker,
  type Constructor,
  type TypeMappings,
  type TypeName,
} from './types'

type PositiveMatcherFunction = (expectations: Expectations) => Expectations
type NegativeMatcherFunction = (expectations: NegativeExpectations) => Expectations

/* ========================================================================== *
 * MATCHERS                                                                   *
 * ========================================================================== */

export class Matcher<T = unknown> {
  private readonly _matchers: PositiveMatcherFunction[]
  readonly not: NegativeMatchers<T>

  constructor() {
    const matchers: PositiveMatcherFunction[] = []
    this.not = new NegativeMatchers(this, matchers)
    this._matchers = matchers
  }

  expect(value: unknown): T {
    let expectations = new Expectations(value, undefined)
    for (const matcher of this._matchers) {
      expectations = matcher(expectations)
    }
    return expectations.value as T
  }

  private _push(matcher: PositiveMatcherFunction): Matcher<any> {
    const matchers = new Matcher()
    matchers._matchers.push(...this._matchers, matcher)
    return matchers
  }

  static {
    (this.prototype as any)[matcherMarker] = matcherMarker
  }

  /* ------------------------------------------------------------------------ *
   * BASIC                                                                    *
   * ------------------------------------------------------------------------ */

  /**
   * Expects the value to be of the specified _extended_ {@link TypeName type},
   * and (if specified) further asserts it with an {@link AssertionFunction}.
   *
   * Negation: {@link NegativeMatchers.toBeA `not.toBeA(...)`}
   */
  toBeA<
    Name extends TypeName,
    Mapped extends TypeMappings[Name],
    Assert extends AssertionFunction<Mapped>,
  >(
      type: Name,
      assertion?: Assert,
  ): Matcher<AssertedType<Mapped, Assert>> {
    return this._push((e) => e.toBeA(type, assertion as AssertionFunction))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` within a given +/- _delta_ range of the
   * specified expected value.
   *
   * Negation: {@link NegativeMatchers.toBeCloseTo `not.toBeCloseTo(...)`}
   */
  toBeCloseTo(value: number, delta: number): Matcher<number>

  /**
   * Expects the value to be a `bigint` within a given +/- _delta_ range of the
   * specified expected value.
   *
   * Negation: {@link NegativeMatchers.toBeCloseTo `not.toBeCloseTo(...)`}
   */
  toBeCloseTo(value: bigint, delta: bigint): Matcher<bigint>

  /**
   * Expects the value to be a `number` or `bigint` within a given +/- _delta_
   * range of the specified expected value.
   *
   * Negation: {@link NegativeMatchers.toBeCloseTo `not.toBeCloseTo(...)`}
   */
  toBeCloseTo(
      value: number | bigint,
      delta: number | bigint,
  ): Matcher {
    return this._push((e) => e.toBeCloseTo(value as number, delta as number))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be neither `null` nor `undefined`.
   *
   * Negation: {@link NegativeMatchers.toBeDefined `not.toBeDefined()`}
   */
  toBeDefined(): Matcher<T> {
    return this._push((e) => e.toBeDefined())
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
  ): Matcher<Error>

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
  ): Matcher<InstanceType<Class>>

  toBeError(
      constructorOrMessage?: string | RegExp | Constructor,
      maybeMessage?: string | RegExp,
  ): Matcher {
    const [ constructor, message ] =
    typeof constructorOrMessage === 'function' ?
      [ constructorOrMessage, maybeMessage ] :
      [ Error, constructorOrMessage ]
    return this._push((e) => e.toBeError(constructor, message))
  }

  /* ------------------------------------------------------------------------ */

  /** Expects the value strictly equal to `false`. */
  toBeFalse(): Matcher<false> {
    return this._push((e) => e.toBeFalse())
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be _falsy_ (zero, empty string, `false`, ...).
   *
   * Negation: {@link Matcher.toBeTruthy `toBeTruthy()`}
   */
  toBeFalsy(): Matcher<T> {
    return this._push((e) => e.toBeFalsy())
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` greater than the specified* expected
   * value.
   *
   * Negation: {@link Matcher.toBeLessThanOrEqual `toBeLessThanOrEqual(...)`}
   */
  toBeGreaterThan(value: number): Matcher<number>

  /**
   * Expects the value to be a `bigint` greater than the specified expected
   * value.
   *
   * Negation: {@link Matcher.toBeLessThanOrEqual `toBeLessThanOrEqual(...)`}
   */
  toBeGreaterThan(value: bigint): Matcher<bigint>

  toBeGreaterThan(value: number | bigint): Matcher {
    return this._push((e) => e.toBeGreaterThan(value as number))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` greater than or equal to the specified
   * expected value.
   *
   * Negation: {@link Matcher.toBeLessThan `toBeLessThan(...)`}
   */
  toBeGreaterThanOrEqual(value: number): Matcher<number>

  /**
   * Expects the value to be a `bigint` greater than or equal to the specified
   * expected value.
   *
   * Negation: {@link Matcher.toBeLessThan `toBeLessThan(...)`}
   */
  toBeGreaterThanOrEqual(value: bigint): Matcher<bigint>

  toBeGreaterThanOrEqual(value: number | bigint): Matcher {
    return this._push((e) => e.toBeGreaterThanOrEqual(value as number))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be an instance of the specified {@link Constructor},
   * and (if specified) further asserts it with an {@link AssertionFunction}.
   *
   * Negation: {@link NegativeMatchers.toBeInstanceOf `not.toInstanceOf(...)`}
   */
  toBeInstanceOf<
    Class extends Constructor,
    Assert extends AssertionFunction<InstanceType<Class>>,
  >(
      constructor: Class,
      assertion?: Assert,
  ): Matcher<AssertedType<InstanceType<Class>, Assert>> {
    return this._push((e) => e.toBeInstanceOf(constructor, assertion as AssertionFunction))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` less than the specified expected value.
   *
   * Negation: {@link Matcher.toBeGreaterThanOrEqual `toBeGreaterThanOrEqual(...)`}
   */
  toBeLessThan(value: number): Matcher<number>

  /**
   * Expects the value to be a `bigint` less than the specified expected value.
   *
   * Negation: {@link Matcher.toBeGreaterThanOrEqual `toBeGreaterThanOrEqual(...)`}
   */
  toBeLessThan(value: bigint): Matcher<bigint>

  toBeLessThan(value: number | bigint): Matcher {
    return this._push((e) => e.toBeLessThan(value as number))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` less than or equal to* the specified
   * expected value.
   *
   * Negation: {@link Matcher.toBeGreaterThan `toBeGreaterThan(...)`}
   */
  toBeLessThanOrEqual(value: number): Matcher<number>

  /**
   * Expects the value to be a `bigint` less than or equal to the specified
   * expected value.
   *
   * Negation: {@link Matcher.toBeGreaterThan `toBeGreaterThan(...)`}
   */
  toBeLessThanOrEqual(value: bigint): Matcher<bigint>

  toBeLessThanOrEqual(value: number | bigint): Matcher {
    return this._push((e) => e.toBeLessThanOrEqual(value as number))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be `NaN`.
   *
   * Negation: {@link NegativeMatchers.toBeNaN `not.toBeNaN()`}
   */
  toBeNaN(): Matcher<number> {
    return this._push((e) => e.toBeNaN())
  }

  /* ------------------------------------------------------------------------ */

  /** Expects the value to strictly equal `null`. */
  toBeNull(): Matcher<null> {
    return this._push((e) => e.toBeNull())
  }

  /* ------------------------------------------------------------------------ */

  /** Expects the value to strictly equal `true`. */
  toBeTrue(): Matcher<true> {
    return this._push((e) => e.toBeTrue())
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be _falsy_ (non-zero, non-empty string, ...).
   *
   * Negation: {@link Matcher.toBeFalsy `toBeFalsy()`}
   */
  toBeTruthy(): Matcher<T> {
    return this._push((e) => e.toBeTruthy())
  }

  /* ------------------------------------------------------------------------ */

  /** Expects the value to strictly equal `undefined`. */
  toBeUndefined(): Matcher<undefined> {
    return this._push((e) => e.toBeUndefined())
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` within the specified range where the
   * minimum and maximum values are inclusive.
   *
   * Negation: {@link NegativeMatchers.toBeWithinRange `not.toBeWithinRange(...)`}
   */
  toBeWithinRange(min: number, max: number): Matcher<number>

  /**
   * Expects the value to be a `bigint` within the specified range where the
   * minimum and maximum values are inclusive.
   *
   * Negation: {@link NegativeMatchers.toBeWithinRange `not.toBeWithinRange(...)`}
   */
  toBeWithinRange(min: bigint, max: bigint): Matcher<bigint>

  /**
   * Expects the value to be a `number` or `bigint` within the specified range
   * where minimum and maximum values are inclusive.
   *
   * Negation: {@link NegativeMatchers.toBeWithinRange `not.toBeWithinRange(...)`}
   */
  toBeWithinRange( min: number | bigint, max: number | bigint): Matcher {
    return this._push((e) => e.toBeWithinRange(min as number, max as number))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be _deep equal to_ the specified expected one.
   *
   * Negation: {@link NegativeMatchers.toEqual `not.toEqual(...)`}
   */
  toEqual<Type>(expected: Type): Matcher<InferMatchers<Type>> {
    return this._push((e) => e.toEqual(expected))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to have a `number` _property_ `length` with the specified
   * expected value.
   *
   * Negation: {@link NegativeMatchers.toHaveLength `not.toHaveLength(...)`}
   */
  toHaveLength(length: number): Matcher<T & { length: number }> {
    return this._push((e) => e.toHaveLength(length))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to have the specified _property_ and (if specified)
   * validates its value with a {@link Matcher}.
   *
   * Negation: {@link NegativeExpectations.toHaveProperty `not.toHaveProperty(...)`}
   */
  toHaveProperty<
    Prop extends string | number | symbol,
    Match extends Matcher,
  >(
    property: Prop,
    matcher?: Match,
  ): Matcher<T & { [keyt in Prop] : InferMatchers<Match> }>

  /**
   * Expects the value to have the specified _property_ and (if specified)
   * further asserts its value with an {@link AssertionFunction}.
   *
   * Negation: {@link NegativeMatchers.toHaveProperty `not.toHaveProperty(...)`}
   */
  toHaveProperty<
    Prop extends string | number | symbol,
    Assert extends AssertionFunction,
  >(
    property: Prop,
    assertion?: Assert,
  ): Matcher<T & { [keyt in Prop] : AssertedType<unknown, Assert> }>

  toHaveProperty(
      property: string | number | symbol,
      assertionOrMatcher?: AssertionFunction | Matcher,
  ): Matcher {
    return this._push((e) => e.toHaveProperty(property, assertionOrMatcher as any))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to have a `number` _property_ `size` with the specified
   * expected value.
   *
   * Negation: {@link NegativeMatchers.toHaveSize `not.toHaveSize(...)`}
   */
  toHaveSize(size: number): Matcher<T & { size: number }> {
    return this._push((e) => e.toHaveSize(size))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expect the value to include _all_ properties from the specified _object_.
   *
   * If the object being expected is a {@link Map}, the properties specified
   * here will be treated as _mappings_ for said {@link Map}.
   *
   * Negation: {@link NegativeMatchers.toInclude `not.toInclude(...)`}
   */
  toInclude<P extends Record<string, any>>(properties: P): Matcher<T>

  /**
   * Expect the value to include _all_ mappings from the specified {@link Map}.
   *
   * Negation: {@link NegativeMatchers.toInclude `not.toInclude(...)`}
   */
  toInclude(mappings: Map<any, any>): Matcher<T>

  /**
   * Expect the value to be an {@link Iterable} object includind _all_ values
   * from the specified {@link Set}, in any order.
   *
   * Negation: {@link NegativeMatchers.toInclude `not.toInclude(...)`}
   */
  toInclude(entries: Set<any>): Matcher<T>

  /**
   * Expect the value to be an {@link Iterable} object includind _all_ values
   * from the specified _array_, in any order.
   *
   * Negation: {@link NegativeMatchers.toInclude `not.toInclude(...)`}
   */
  toInclude(values: any[]): Matcher<T>

  toInclude(
      contents: Record<string, any> | Map<any, any> | Set<any> | any[],
  ): Matcher {
    return this._push((e) => e.toInclude(contents))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `string` _matching_ the specified sub-`string`
   * or {@link RegExp}.
   *
   * Negation: {@link NegativeMatchers.toMatch `not.toMatch(...)`}
   */
  toMatch<Match extends string | RegExp>(
      matcher: Match,
  ): Matcher<string> {
    return this._push((e) => e.toMatch(matcher))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expect the value to be an {@link Iterable} object includind _all_ values
   * (and only those values) from the specified _array_, in any order.
   */
  toMatchContents(contents: any[]): Matcher<T>

  /**
   * Expect the value to be an {@link Iterable} object includind _all_ values
   * (and only those values) from the specified {@link Set}, in any order.
   */
  toMatchContents(contents: Set<any>): Matcher<T>

  toMatchContents(contents: any[] | Set<any>): Matcher {
    return this._push((e) => e.toMatchContents(contents))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be _strictly equal to_ the specified expected one.
   *
   * Negation: {@link NegativeMatchers.toStrictlyEqual `not.toStrictlyEqual(...)`}
   */
  toStrictlyEqual<Type>(expected: Type): Matcher<Type> {
    return this._push((e) => e.toStrictlyEqual(expected))
  }
}

/* ========================================================================== *
 * NEGATIVE MATCHERS                                                          *
 * ========================================================================== */

export class NegativeMatchers<T = unknown> {
  constructor(
      private readonly _instance: Matcher<T>,
      private readonly _matchers: PositiveMatcherFunction[],
  ) {}

  private _push(matcher: NegativeMatcherFunction): Matcher<any> {
    this._matchers.push((expectations) => matcher(expectations.not))
    return this._instance
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value _**NOT**_ to be of the specified _extended_
   * {@link TypeName type}.
   *
   * Negates: {@link Matcher.toBeA `toBeA(...)`}
   */
  toBeA(type: TypeName): Matcher<T> {
    return this._push((e) => e.toBeA(type))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` _**OUTSIDE**_ of the given +/- _delta_
   * range of the specified expected value.
   *
   * Negates: {@link Matcher.toBeCloseTo `toBeCloseTo(...)`}
   */
  toBeCloseTo(value: number, delta: number): Matcher<number>

  /**
   * Expects the value to be a `bigint` _**OUTSIDE**_ of the given +/- _delta_
   * range of the specified expected value.
   *
   * Negates: {@link Matcher.toBeCloseTo `toBeCloseTo(...)`}
   */
  toBeCloseTo(value: bigint, delta: bigint): Matcher<bigint>

  toBeCloseTo(value: number | bigint, delta: number | bigint): Matcher {
    return this._push((e) => e.toBeCloseTo(value as number, delta as number))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be either `null` or `undefined`.
   *
   * Negates: {@link Matcher.toBeDefined `toBeDefined()`}
   */
  toBeDefined(): Matcher<null | undefined> {
    return this._push((e) => e.toBeDefined())
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value _**NOT**_ to be an instance of the specified
   * {@link Constructor}.
   *
   * Negates: {@link Matcher.toBeInstanceOf `toBeInstanceOf(...)`}
   */
  toBeInstanceOf(constructor: Constructor): Matcher<T> {
    return this._push((e) => e.toBeInstanceOf(constructor))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value _**NOT**_ to be `NaN`.
   *
   * Negates: {@link Matcher.toBeNaN `toBeNaN()`}
   */
  toBeNaN(): Matcher<number> {
    return this._push((e) => e.toBeNaN())
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` _**OUTSIDE**_ of the specified range
   * where minimum and maximum values are inclusive.
   *
   * Negates: {@link Matcher.toBeWithinRange `toBeWithinRange(...)`}
   */
  toBeWithinRange(min: number, max: number): Matcher<number>

  /**
   * Expects the value to be a `bigint` _**OUTSIDE**_ of the specified range
   * where minimum and maximum values are inclusive.
   *
   * Negates: {@link Matcher.toBeWithinRange `toBeWithinRange(...)`}
   */
  toBeWithinRange(min: bigint, max: bigint): Matcher<bigint>

  toBeWithinRange(min: number | bigint, max: number | bigint): Matcher {
    return this._push((e) => e.toBeWithinRange(min as number, max as number))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value _**NOT**_ to be _deep equal to_ the specified expected
   * one.
   *
   * Negates: {@link Matcher.toEqual `toEqual(...)`}
   */
  toEqual(expected: any): Matcher<T> {
    return this._push((e) => e.toEqual(expected))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to have a `number` _property_ `length` _different_ from
   * the specified expected value.
   *
   * Negates: {@link Matcher.toHaveLength `toHaveLength(...)`}
   */
  toHaveLength(length: number): Matcher<T & { length: number }> {
    return this._push((e) => e.toHaveLength(length))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value _**NOT**_ to have the specified _property_.
   *
   * Negates: {@link Matcher.toHaveProperty `toHaveProperty(...)`}
   */
  toHaveProperty(property: string | number | symbol): Matcher<T> {
    return this._push((e) => e.toHaveProperty(property))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to have a `number` _property_ `size` _different_ from
   * the specified expected value.
   *
   * Negates: {@link Matcher.toHaveSize `toHaveSize(...)`}
   */
  toHaveSize(size: number): Matcher<T & { size: number }> {
    return this._push((e) => e.toHaveSize(size))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expect the value to include _none_ of the properties from the specified
   * _object_.
   *
   * If the object being expected is a {@link Map}, the properties specified
   * here will be treated as _mappings_ for said {@link Map}.
   *
   * Negates: {@link Matcher.toInclude `toInclude(...)`}
   */
  toInclude<P extends Record<string, any>>(properties: P): Matcher<T>

  /**
   * Expect the value to include _none_ of the mappings from the specified
   * {@link Map}.
   *
   * Negates: {@link Matcher.toInclude `toInclude(...)`}
   */
  toInclude(mappings: Map<any, any>): Matcher<T>

  /**
   * Expect the value to be an {@link Iterable} object includind _none_ of the
   * values from the specified {@link Set}.
   *
   * Negates: {@link Matcher.toInclude `toInclude(...)`}
   */
  toInclude(entries: Set<any>): Matcher<T>

  /**
   * Expect the value to be an {@link Iterable} object includind _none_ of the
   * values from the specified _array_.
   *
   * Negates: {@link Matcher.toInclude `toInclude(...)`}
   */
  toInclude(values: any[]): Matcher<T>

  toInclude(
      contents: Record<string, any> | Map<any, any> | Set<any> | any[],
  ): Matcher {
    return this._push((e) => e.toInclude(contents))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `string` _**NOT MATCHING**_ the specified
   * sub-`string` or {@link RegExp}.
   *
   * Negates: {@link Matcher.toMatch `toMatch(...)`}
   */
  toMatch(matcher: string | RegExp): Matcher<string> {
    return this._push((e) => e.toMatch(matcher))
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value _**NOT**_ to be _strictly equal to_ the specified
   * expected one.
   *
   * Negates: {@link Matcher.toStrictlyEqual `toStrictlyEqual(...)`}
   */
  toStrictlyEqual(expected: any): Matcher<T> {
    return this._push((e) => e.toStrictlyEqual(expected))
  }
}
