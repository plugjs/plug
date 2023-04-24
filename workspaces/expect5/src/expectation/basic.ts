import { diff } from './diff'
import { assertContextType, ExpectationError, prefixType, stringifyConstructor, stringifyValue, typeOf } from './types'

import type { AssertedType, AssertionFunction, Expectations, ExpectationsContext, JoinExpectations } from './expect'
import type { Constructor, TypeName, TypeMappings } from './types'

/* === TO BE A ============================================================== */

/** Expects the value to be of the specified {@link TypeName type}. */
function toBeA<T extends TypeName>(type: T): Expectations<TypeMappings[T]>

/**
 * Expects the value to be of the specified {@link TypeName type}, and further
 * asserts it with the specified callback.
 */
function toBeA<T extends TypeName>(type: T, assert: (valueExpectations: Expectations) => void): Expectations<TypeMappings[T]>

/* Overloaded function implementation */
function toBeA<T extends TypeName>(
    this: ExpectationsContext,
    type: T,
    assert?: (valueExpectations: Expectations) => void,
): Expectations {
  const match = typeOf(this.value) === type
  if (match === this._negative) {
    throw new ExpectationError(this, this._negative, `to be ${prefixType(type)}`)
  } else if (assert) {
    assert(this._expectations)
  }
  return this._expectations
}

/* === TO BE CLOSE TO ======================================================= */

/**
 * Expects the value to be a `number` within a given +/- delta range of the
 * specified `number`.
 */
function toBeCloseTo(value: number, delta: number): Expectations<number>

/**
 * Expects the value to be a a `bigint` within a given +/- delta range of the
 * specified `bigint`.
 */
function toBeCloseTo(value: bigint, delta: bigint): Expectations<bigint>

/* Overloaded function implementation */
function toBeCloseTo(
    this: ExpectationsContext,
    value: number | bigint,
    delta: number | bigint,
): Expectations {
  const min = (value as number) - (delta as number)
  const max = (value as number) + (delta as number)
  return this._negated.toBeWithinRange(min, max)
}

/* === TO BE ERROR ========================================================== */

/** Expects the value to be an {@link Error}. */
function toBeError(): Expectations<Error>

/** Expects the value to be an {@link Error} with the specified message. */
function toBeError(message: string): Expectations<Error>

/**
 * Expects the value to be an {@link Error} with its message matching the
 * specified {@link RegExp}.
 */
function toBeError(matcher: RegExp): Expectations<Error>

/** Expects the value to be an {@link Error} of the specified _type_. */
function toBeError<C extends Constructor<Error>>(constructor: C): Expectations<InstanceType<C>>

/**
 * Expects the value to be an {@link Error} of the specified _type_  with the
 * specified message
 */
function toBeError<C extends Constructor<Error>>(constructor: C, message: string): Expectations<InstanceType<C>>

/**
 * Expects the value to be an {@link Error} of the specified _type_  with the
 * specified message
 */
function toBeError<C extends Constructor<Error>>(constructor: C, matcher: RegExp): Expectations<InstanceType<C>>

/* Overloaded function implementation */
function toBeError(
    this: ExpectationsContext,
    ...args:
    | []
    | [ message: string | RegExp ]
    | [ constructor: Constructor<Error> ]
    | [ constructor: Constructor<Error>, message: string | RegExp ]
): Expectations {
  const [ constructor, message ] =
    typeof args[0] === 'function' ?
      [ args[0], args[1] ] :
      [ Error, args[0] ]

  this._negated.toBeInstanceOf(constructor)

  // if "not.toBeError" ignore the message
  if (this._negative || (message === undefined)) return this._expectations

  return this._expectations.toHaveProperty('message', (assert) => {
    assert.toBeA('string')
    return typeof message === 'string' ?
        assert.toStrictlyEqual(message) :
        assert.toMatch(message)
  })
}


/* === TO BE GREATER THAN =================================================== */

/** Expects the value to be a `number` greater than the specified `number`. */
function toBeGreaterThan(value: number): Expectations<number>
/** Expects the value to be a `bigint` greater than the specified `bigint`. */
function toBeGreaterThan(value: bigint): Expectations<bigint>

/* Overloaded function implementation */
function toBeGreaterThan(
    this: ExpectationsContext,
    value: number | bigint,
): Expectations {
  assertContextType(this, typeof value as 'number' | 'bigint')
  if ((this.value > value) !== this._negative) return this._expectations
  throw new ExpectationError(this, this._negative, `to be greater than ${stringifyValue(value)}`)
}

/* === TO BE GREATER THAN OR EQUAL ========================================== */

/** Expects the value to be a `number` greater than or equal to the specified `number`. */
function toBeGreaterThanOrEqual(value: number): Expectations<number>
/** Expects the value to be a `bigint` greater than or equal to the specified `bigint`. */
function toBeGreaterThanOrEqual(value: bigint): Expectations<bigint>

/* Overloaded function implementation */
function toBeGreaterThanOrEqual(
    this: ExpectationsContext,
    value: number | bigint,
): Expectations {
  assertContextType(this, typeof value as 'number' | 'bigint')
  if ((this.value >= value) !== this._negative) return this._expectations
  throw new ExpectationError(this, this._negative, `to be greater than or equal to ${stringifyValue(value)}`)
}

/* === TO BE INSTANCE OF ==================================================== */

/** Expects the value to be an instance of the specified _type_. */
function toBeInstanceOf<C extends Constructor>(value: C): Expectations<InstanceType<C>>

/* Overloaded function implementation */
function toBeInstanceOf(
    this: ExpectationsContext,
    value: Constructor,
): Expectations {
  const match = this.value instanceof value
  if (match !== this._negative) return this._expectations
  throw new ExpectationError(this, this._negative, `to be an instance of ${stringifyConstructor(value)}`)
}

/* === TO BE LESS THAN ====================================================== */

/** Expects the value to be a `number` less than the specified `number`. */
function toBeLessThan(value: number): Expectations<number>
/** Expects the value to be a `bigint` less than the specified `bigint`. */
function toBeLessThan(value: bigint): Expectations<bigint>

/* Overloaded function implementation */
function toBeLessThan(
    this: ExpectationsContext,
    value: number | bigint,
): Expectations {
  assertContextType(this, typeof value as 'number' | 'bigint')
  if ((this.value < value) !== this._negative) return this._expectations
  throw new ExpectationError(this, this._negative, `to be less than ${stringifyValue(value)}`)
}

/* === TO BE LESS THAN OR EQUAL ============================================= */

/** Expects the value to be a `number` less than or equal to the specified `number`. */
function toBeLessThanOrEqual(value: number): Expectations<number>
/** Expects the value to be a `bigint` less than or equal to the specified `bigint`. */
function toBeLessThanOrEqual(value: bigint): Expectations<bigint>

/* Overloaded function implementation */
function toBeLessThanOrEqual(
    this: ExpectationsContext,
    value: number | bigint,
): Expectations {
  assertContextType(this, typeof value as 'number' | 'bigint')
  if ((this.value <= value) !== this._negative) return this._expectations
  throw new ExpectationError(this, this._negative, `to be less than or equal to ${stringifyValue(value)}`)
}

/* === TO WITHIN RANGE ====================================================== */

/** Expects the value to be a `number` within the specified range (inclusive). */
function toBeWithinRange(min: number, max: number): Expectations<number>
/** Expects the value to be a `bigint` within the specified range (inclusive). */
function toBeWithinRange(min: bigint, max: bigint): Expectations<bigint>

/* Overloaded function implementation */
function toBeWithinRange(
    this: ExpectationsContext,
    min: number | bigint,
    max: number | bigint,
): Expectations {
  if (max < min) {
    const num = max
    max = min
    min = num
  }

  assertContextType(this, typeof min as 'number' | 'bigint')
  if (((this.value >= min) && (this.value <= max)) !== this._negative) return this._expectations
  throw new ExpectationError(this, this._negative, `to be within ${stringifyValue(min)}...${stringifyValue(max)}`)
}

/* === TO EQUAL ============================================================= */

/** Expects the value to _deeply equal_ to the specified expected value. */
function toEqual<T>(expected: T): Expectations<T>

/* Overloaded function implementation */
function toEqual(
    this: ExpectationsContext,
    expected: any,
): Expectations {
  const result = diff(this.value, expected)
  if (result.diff === this._negative) return this._expectations
  throw new ExpectationError(this, this._negative, `to equal ${stringifyValue(expected)}`, result)
}

/* === TO HAVE LENGTH ======================================================= */

/** Expects the value to have a numerical `length` property with the specified value. */
function toHaveLength<T, N extends number>(this: T, length: N): JoinExpectations<T, { length: N }>

/* Overloaded function implementation */
function toHaveLength(
    this: ExpectationsContext,
    length: number,
): Expectations {
  this._expectations.toBeDefined()

  const actualLength = (this.value as any).length
  if (typeof actualLength !== 'number') {
    throw new ExpectationError(this, false, 'to have a numeric "length" property')
  }

  if ((actualLength === length) === this._negative) {
    throw new ExpectationError(this, this._negative, `to have length ${stringifyValue(length)}`)
  }

  return this._expectations
}

/* === TO HAVE PROPERTY ===================================================== */

/** Expects the value to have a property. */
function toHaveProperty<T, P extends string | number | symbol, A extends AssertionFunction>(
  this: T,
  prop: P,
): JoinExpectations<T, { [key in P]: AssertedType<A> }>

/**
 * Expects the value to have a property, and further asserts the property
 * value with the specified callback.
 */
function toHaveProperty<T, P extends string | number | symbol, A extends AssertionFunction>(
  this: T,
  prop: P,
  assert: A,
): JoinExpectations<T, { [key in P]: AssertedType<A> }>

/* Overloaded function implementation */
function toHaveProperty(
    this: ExpectationsContext,
    prop: string | symbol | number,
    assert?: AssertionFunction,
): Expectations {
  this._expectations.toBeDefined()

  const match = (this.value as any)[prop] !== undefined
  if (match === this._negative) {
    throw new ExpectationError(this, this._negative, `to have property "${String(prop)}"`)
  } else if (match && assert) {
    try {
      assert(this.forProperty(prop)._expectations)
    } catch (error) {
      // any caught error difference gets remapped as a property diff
      if ((error instanceof ExpectationError) && (error.diff)) {
        error.diff = {
          diff: true,
          value: this.value,
          props: { [prop]: error.diff },
        }
      }

      // re-throw
      throw error
    }
  }

  return this._expectations
}


/* === TO HAVE SIZE ========================================================= */

/** Expects the value to have a numerical `size` property with the specified value. */
function toHaveSize<T, N extends number>(this: T, size: N): JoinExpectations<T, { size: N }>

/* Overloaded function implementation */
function toHaveSize(
    this: ExpectationsContext,
    size: number,
): Expectations {
  this._expectations.toBeDefined()

  const actualSize = (this.value as any).size
  if (typeof actualSize !== 'number') {
    throw new ExpectationError(this, false, 'to have a numeric "size" property')
  }

  if ((actualSize === size) === this._negative) {
    throw new ExpectationError(this, this._negative, `to have size ${stringifyValue(size)}`)
  }

  return this._expectations
}

/* === TO MATCH ============================================================= */

function toMatch(substring: string): Expectations<string>
function toMatch(expression: RegExp): Expectations<string>
function toMatch(
    this: ExpectationsContext,
    expr: string | RegExp,
): Expectations {
  assertContextType(this, 'string')

  const match = !! this.value.match(expr)
  if (match !== this._negative) return this._expectations

  throw new ExpectationError(this, this._negative, `to match ${stringifyValue(expr)}`)
}


/* === TO STRICTLY EQUAL ==================================================== */

/** Expects the value to _strictly equal_ to the specified expected value. */
function toStrictlyEqual<T>(expected: T): Expectations<T>

/* Overloaded function implementation */
function toStrictlyEqual(
    this: ExpectationsContext,
    expected: any,
): Expectations {
  // const value = context.value
  const match = this.value === expected
  if (match !== this._negative) return this._expectations

  const diff = this._negative ? undefined : { diff: true, value: this.value, expected }
  throw new ExpectationError(this, this._negative, `to strictly equal ${stringifyValue(expected)}`, diff)
}

/* === EXPORTS ============================================================== */

/* coverage ignore next */
export {
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
}
