import { diff, type Diff } from './diff'
import { toInclude, toMatchContents } from './include'
import { ExpectationError, prefixType, stringifyConstructor, stringifyValue, typeOf, type Constructor, type TypeMappings, type TypeName } from './types'

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

/** Simple wrapper defining the _parent_ instance of an {@link Expectations}. */
type ExpectationsParent = {
  /** Parent {@link Expectations} instance */
  expectations: Expectations,
  /** Property associating _this_ to the parent */
  prop: string | number | symbol,
}

/* ========================================================================== *
 * EXPECTATIONS                                                               *
 * ========================================================================== */

export class Expectations<T = unknown> {
  /** The {@link NegativeExpectations} associated with _this_ */
  readonly not: NegativeExpectations<T>

  /**
   * Create an {@link Expectations} instance associated with the specified
   * value and (optionally) a parent {@link Expectations} instance
   */
  constructor(
      /** The value associated with this instance */
      readonly value: T,
      /**
       * An optional {@link ExpectationsParent} defining _this_ to be a
       * child of another {@link Expectations} instance
       */
      readonly parent?: ExpectationsParent,
  ) {
    this.not = new NegativeExpectations(this)
  }

  /** Throw an {@link ExpectationError} associated with _this_ */
  private _fail(details: string, diff?: Diff): never {
    throw new ExpectationError(this, details, diff)
  }

  /* ------------------------------------------------------------------------ *
   * BASIC                                                                    *
   * ------------------------------------------------------------------------ */

  /**
   * Expects the value to be of the specified _extended_ {@link TypeName type},
   * and (if specified) further asserts it with an {@link AssertionFunction}.
   *
   * Negation: {@link NegativeExpectations.toBeA `not.toBeA(...)`}
   */
  toBeA<
    Name extends TypeName,
    Mapped extends TypeMappings[Name],
    Assert extends AssertionFunction<Mapped>,
  >(
      type: Name,
      assertion?: Assert,
  ): Expectations<AssertedType<Mapped, Assert>> {
    if (typeOf(this.value) === type) {
      if (assertion) assertion(this as Expectations<any>)
      return this as Expectations<any>
    }

    this._fail(`to be ${prefixType(type)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` or `bigint` within a given +/- _delta_
   * range of the specified expected value.
   *
   * Negation: {@link NegativeExpectations.toBeCloseTo `not.toBeCloseTo(...)`}
   */
  toBeCloseTo<Type extends number | bigint>(
      value: Type,
      delta: Type,
  ): Expectations<Type> {
    const min = (value as number) - (delta as number)
    const max = (value as number) + (delta as number)
    return this.toBeWithinRange(min, max) as Expectations<any>
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
   * Expects the value to be a `number` or `bigint` greater than the specified
   * expected value.
   *
   * Negation: {@link Expectations.toBeLessThanOrEqual `toBeLessThanOrEqual(...)`}
   */
  toBeGreaterThan<Type extends number | bigint>(
      value: Type,
  ): Expectations<Type> {
    this.toBeA(typeof value)
    if ((this.value as any) > value) return this as Expectations<any>
    this._fail(`to be greater than ${stringifyValue(value)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` or `bigint` greater than or equal to
   * the specified expected value.
   *
   * Negation: {@link Expectations.toBeLessThan `toBeLessThan(...)`}
   */
  toBeGreaterThanOrEqual<Type extends number | bigint>(
      value: Type,
  ): Expectations<Type> {
    this.toBeA(typeof value)
    if ((this.value as any) >= value) return this as Expectations<any>
    this._fail(`to be greater than or equal to ${stringifyValue(value)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be an instance of the specified {@link Constructor},
   * and (if specified) further asserts it with an {@link AssertionFunction}.
   *
   * Negation: {@link NegativeExpectations.toBeInstanceOf `not.toInstanceOf(...)`}
   */
  toBeInstanceOf<
    Instance,
    Class extends Constructor<Instance>,
    Assert extends AssertionFunction<Instance>,
  >(
      constructor: Class,
      assertion?: Assert,
  ): Expectations<AssertedType<InstanceType<Class>, Assert>> {
    if (this.value instanceof constructor) {
      if (assertion) assertion(this as Expectations<any>)
      return this as Expectations<any>
    }

    this._fail(`to be an instance of ${stringifyConstructor(constructor)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` or `bigint` less than the specified
   * expected value.
   *
   * Negation: {@link Expectations.toBeGreaterThanOrEqual `toBeGreaterThanOrEqual(...)`}
   */
  toBeLessThan<Type extends number | bigint>(
      value: Type,
  ): Expectations<Type> {
    this.toBeA(typeof value)
    if ((this.value as any) < value) return this as Expectations<any>
    this._fail(`to be less than ${stringifyValue(value)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` or `bigint` less than or equal to
   * the specified expected value.
   *
   * Negation: {@link Expectations.toBeGreaterThan `toBeGreaterThan(...)`}
   */
  toBeLessThanOrEqual<Type extends number | bigint>(
      value: Type,
  ): Expectations<Type> {
    this.toBeA(typeof value)
    if ((this.value as any) <= value) return this as Expectations<any>
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
   * Expects the value to be a `number` or `bigint` within the specified range
   * where minimum and maximum values are inclusive.
   *
   * Negation: {@link NegativeExpectations.toBeWithinRange `not.toBeWithinRange(...)`}
   */
  toBeWithinRange<Type extends number | bigint>(
      min: Type,
      max: Type,
  ): Expectations<Type> {
    if (max < min) {
      const num = max
      max = min
      min = num
    }

    this.toBeA(typeof min)

    if (((this.value as any) < min) || ((this.value as any) > max)) {
      this._fail(`to be within ${stringifyValue(min)}...${stringifyValue(max)}`)
    }

    return this as Expectations<any>
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be _deep equal to_ the specified expected one.
   *
   * Negation: {@link NegativeExpectations.toEqual `not.toEqual(...)`}
   */
  toEqual<Type>(expected: Type): Expectations<Type> {
    if ((this.value as any) === expected) return this as Expectations<any>

    const result = diff(this.value, expected)

    if (result.diff) {
      this._fail(`to equal ${stringifyValue(expected)}`, result)
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
  toHaveLength<Length extends number>(
      length: Length,
  ): Expectations<T & { length: Length }> {
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
      assertion?: Assert,
  ): Expectations<T & { [keyt in Prop] : AssertedType<T, Assert> }> {
    this.toBeDefined()

    const propertyValue = (this.value as any)[property]

    if (propertyValue === undefined) {
      this._fail(`to have property "${String(property)}"`)
    }

    if (assertion) {
      try {
        const parent: ExpectationsParent = { expectations: this, prop: property }
        const expectations = new Expectations(propertyValue, parent)
        assertion(expectations)
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
  toHaveSize<Size extends number>(
      size: Size,
  ): Expectations<T & { size: Size }> {
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
   * (and only those values) from the specified _array_, in any order.
   */
  toMatchContents(contents: any[]): Expectations<T>

  /**
   * Expect the value to be an {@link Iterable} object includind _all_ values
   * (and only those values) from the specified {@link Set}, in any order.
   */
  toMatchContents(contents: Set<any>): Expectations<T>

  toMatchContents(contents: any[] | Set<any>): Expectations {
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
   * Expects the value to be a `function` throwing, and (if specified) further
   * asserts the thrown value with an {@link AssertionFunction}.
   */
  toThrow(assert?: AssertionFunction): Expectations<T & (() => any)> {
    const func = this.toBeA('function')

    let passed: boolean = false
    let thrown: unknown = undefined
    try {
      func.value()
      passed = true
    } catch (caught) {
      thrown = caught
    }

    if (passed) this._fail('to throw')
    if (assert) assert(new Expectations(thrown))
    return this as Expectations<any>
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `function` throwing an {@link Error}.
   *
   * If specified, the {@link Error}'s own message will be further expected to
   * either match the specified {@link RegExp}, or equal to the specified
   * `string`.
   */
  toThrowError(
    message?: string | RegExp
  ): Expectations<T & (() => any)>

  /**
   * Expects the value to be a `function` throwing an instance of the
   * {@link Error} identified by the specified {@link Constructor}.
   *
   * If specified, the {@link Error}'s own message will be further expected to
   * either match the specified {@link RegExp}, or equal to the specified
   * `string`.
   */
  toThrowError<Class extends Constructor<Error>>(
    constructor: Class,
    message?: string | RegExp,
  ): Expectations<T & (() => any)>

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

  /* ------------------------------------------------------------------------ *
   * ASYNC EXPECTATIONS                                                       *
   * ------------------------------------------------------------------------ */

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
            if (assertion) assertion(new Expectations(settlement.reason))
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
            if (assertion) assertion(new Expectations(settlement.value))
            return this as Expectations<any>
          }

          this._fail('to be resolved')
        })
  }
}


/* ========================================================================== *
 * NEGATIVE EXPECTATIONS                                                      *
 * ========================================================================== */

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
    throw new ExpectationError(this._expectations, `not ${details}`, diff)
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
    this._fail(`to be ${prefixType(type)}`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` or `bigint` _**OUTSIDE**_ of the given
   * +/- _delta_ range of the specified expected value.
   *
   * Negates: {@link Expectations.toBeCloseTo `toBeCloseTo(...)`}
   */
  toBeCloseTo<Type extends number | bigint>(
      value: Type,
      delta: Type,
  ): Expectations<Type> {
    const min = (value as number) - (delta as number)
    const max = (value as number) + (delta as number)
    return this.toBeWithinRange(min, max) as Expectations<Type>
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

    throw new ExpectationError(
        this._expectations,
        `to be ${stringifyValue(null)} or ${stringifyValue(undefined)}`)
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
      this._fail(`to be an instance of ${stringifyConstructor(constructor)}`)
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
    if (isNaN(expectations.value)) this._fail(`to be ${stringifyValue(NaN)}`)
    return expectations
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to be a `number` or `bigint` _**OUTSIDE**_ of the
   * specified range where minimum and maximum values are inclusive.
   *
   * Negates: {@link Expectations.toBeWithinRange `toBeWithinRange(...)`}
   */
  toBeWithinRange<Type extends number | bigint>(
      min: Type,
      max: Type,
  ): Expectations<Type> {
    if (max < min) {
      const num = max
      max = min
      min = num
    }

    this._expectations.toBeA(typeof min)

    if (((this._value as any) >= min) && ((this._value as any) <= max)) {
      this._fail(`to be within ${stringifyValue(min)}...${stringifyValue(max)}`)
    }

    return this._expectations as Expectations<any>
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value _**NOT**_ to be _deep equal to_ the specified expected
   * one.
   *
   * Negates: {@link Expectations.toEqual `toEqual(...)`}
   */
  toEqual(expected: any): Expectations<T> {
    let result: Diff = { diff: false, value: this._value }
    if (this._value !== expected) {
      result = diff(this._value, expected)
      if (result.diff) return this._expectations
    }

    this._fail(`to equal ${stringifyValue(expected)}`, result)
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
      throw new ExpectationError(this._expectations, 'to have a numeric "length" property')
    } else if (realLength === length) {
      this._fail(`to have length ${length}`)
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

    const propertyValue = (this._value as any)[property]
    if (propertyValue === undefined) return this._expectations
    this._fail(`to have property "${String(property)}"`)
  }

  /* ------------------------------------------------------------------------ */

  /**
   * Expects the value to have a `number` _property_ `size` _different_ from
   * the specified expected value.
   *
   * Negates: {@link Expectations.toHaveSize `toHaveSize(...)`}
   */
  toHaveSize(size: number): Expectations<T> {
    this._expectations.toBeDefined()

    const realSize = (this._value as any)['size']
    if (typeof realSize !== 'number') {
      throw new ExpectationError(this._expectations, 'to have a numeric "size" property')
    } else if (realSize === size) {
      this._fail(`to have size ${size}`)
    }

    return this._expectations
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

    this._fail(`to match ${stringifyValue(matcher)}`)
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
    this._fail(`to strictly equal ${stringifyValue(expected)}`)
  }
}
