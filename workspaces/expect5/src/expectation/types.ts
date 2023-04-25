import type { Diff } from './diff'
import type { Expectations, ExpectationsMatcher } from './expect'

/* ========================================================================== *
 * INTERNAL TYPES FOR EXPECTATIONS                                            *
 * ========================================================================== */

/** A type identifying any constructor */
export type Constructor<T = any> = new (...args: any[]) => T

/** A type identifying any function */
export type Callable<T = any> = (...args: readonly any[]) => T

/** A simple _record_ indicating an `object` but never an `array` */
export type NonArrayObject<T = any> = {
  [a: string]: T
  [b: symbol]: T
  [c: number]: never
}

/** Mappings for our _expanded_ {@link typeOf} implementation */
export type TypeMappings = {
  // standard types, from "typeof"
  bigint: bigint,
  boolean: boolean,
  function: Callable,
  number: number,
  string: string,
  symbol: symbol,
  undefined: undefined,
  // specialized object types
  array: readonly any [],
  buffer: Buffer,
  map: Map<any, any>,
  promise: PromiseLike<any>,
  regexp: RegExp,
  set: Set<any>,
  // object: anything not mapped above, not null, and not an array
  object: NonArrayObject<any>,
  // oh, javascript :-(
  null: null,
}

/** Values returned by our own _expanded_ `{@link typeOf}` */
export type TypeName = keyof TypeMappings

export type JoinExpectations<E, T2> =
  E extends Expectations<infer T1> ? Expectations<T1 & T2> : Expectations<T2>

export type AssertionFunction<T = unknown> = (assert: Expectations<T>) => void | Expectations

export type AssertedType<F extends AssertionFunction<any>, R = ReturnType<F>> =
  R extends Expectations<infer T> ? T : unknown

export interface ExpectationsContext<T = unknown> {
  readonly value: T,
  readonly _negative: boolean,
  readonly _parent?: ExpectationsParent
  readonly _expectations: Expectations<T>
  readonly _negated: Expectations<T>

  forValue<V>(value: V): Expectations<V>,
  forProperty(prop: string | number | symbol): Expectations
}

/** Parent expectations */
export interface ExpectationsParent {
  context: ExpectationsContext,
  prop: string | number | symbol,
}

/* ========================================================================== *
 * TYPE INSPECTION, GUARD, AND ASSERTION                                      *
 * ========================================================================== */

/** Expanded `typeof` implementation returning some extra types */
export function typeOf(value: unknown): TypeName {
  if (value === null) return 'null' // oh, javascript :-(

  // primitive types
  const type = typeof value
  switch (type) {
    case 'bigint':
    case 'boolean':
    case 'function':
    case 'number':
    case 'string':
    case 'symbol':
    case 'undefined':
      return type
  }

  // extended types
  if (Array.isArray(value)) return 'array'

  if (value instanceof Promise) return 'promise'
  if (typeof (value as any)['then'] === 'function') return 'promise'

  if (value instanceof Buffer) return 'buffer'
  if (value instanceof RegExp) return 'regexp'
  if (value instanceof Map) return 'map'
  if (value instanceof Set) return 'set'

  // anything else is an object
  return 'object'
}

/** Asserts that the specified `value` is of the specified _expanded_ `type` */
export function assertContextType<T extends keyof TypeMappings>(
    context: ExpectationsContext,
    type: T,
): asserts context is ExpectationsContext<TypeMappings[T]> {
  if (typeOf(context.value) === type) return

  throw new ExpectationError(context, `to be ${prefixType(type)}`, false)
}

/* ========================================================================== *
 * PRETTY PRINTING FOR MESSAGES AND DIFFS                                     *
 * ========================================================================== */

/** Get constructor name or default for {@link stringifyValue} */
function constructorName(value: Record<any, any>): string {
  return Object.getPrototypeOf(value)?.constructor?.name
}

/** Format binary data for {@link stringifyValue} */
function formatBinaryData(value: Record<any, any>, buffer: Buffer): string {
  const binary = buffer.length > 20 ?
      `${buffer.toString('hex', 0, 20)}\u2026, length=${value.length}` :
      buffer.toString('hex')
  return binary ?
      `[${constructorName(value)}: ${binary}]` :
      `[${constructorName(value)}: empty]`
}

/* ========================================================================== */

/** Stringify the type of an object (its constructor name) */
export function stringifyObjectType(value: object): string {
  const proto = Object.getPrototypeOf(value)
  if (! proto) return '[Object: null prototype]'
  return stringifyConstructor(proto.constructor)
}

/** Stringify a constructor */
export function stringifyConstructor(ctor: Constructor): string {
  if (! ctor) return '[Object: no constructor]'
  if (! ctor.name) return '[Object: anonymous]'
  return `[${ctor.name}]`
}

/** Pretty print the value (strings, numbers, booleans) or return the type */
export function stringifyValue(value: unknown): string {
  if (value === null) return '<null>'
  if (value === undefined) return '<undefined>'

  switch (typeof value) {
    case 'string':
      if (value.length > 40) value = `${value.substring(0, 40)}\u2026, length=${value.length}`
      return JSON.stringify(value)
    case 'number':
      if (value === Number.POSITIVE_INFINITY) return '+Infinity'
      if (value === Number.NEGATIVE_INFINITY) return '-Infinity'
      return String(value)
    case 'boolean':
      return String(value)
    case 'bigint':
      return `${value}n`
    case 'function':
      return value.name ? `<function ${value.name}>` : '<function>'
    case 'symbol':
      return value.description ? `<symbol ${value.description}>`: '<symbol>'
  }

  // specific object types
  if (isMatcher(value)) return '<matcher>'
  if (value instanceof RegExp) return String(value)
  if (value instanceof Date) return `[${constructorName(value)}: ${value.toISOString()}]`
  if (value instanceof Boolean) return `[${constructorName(value)}: ${value.valueOf()}]`
  if (value instanceof Number) return `[${constructorName(value)}: ${stringifyValue(value.valueOf())}]`
  if (value instanceof String) return `[${constructorName(value)}: ${stringifyValue(value.valueOf())}]`

  if (Array.isArray(value)) return `[${constructorName(value)} (${value.length})]`
  if (value instanceof Set) return `[${constructorName(value)} (${value.size})]`
  if (value instanceof Map) return `[${constructorName(value)} (${value.size})]`

  if (value instanceof Buffer) return formatBinaryData(value, value)
  if (value instanceof Uint8Array) return formatBinaryData(value, Buffer.from(value))
  if (value instanceof ArrayBuffer) return formatBinaryData(value, Buffer.from(value))
  if (value instanceof SharedArrayBuffer) return formatBinaryData(value, Buffer.from(value))

  // inspect anything else...
  return stringifyObjectType(value)
}

/** Add the `a`/`an`/... prefix to the type name */
export function prefixType(type: TypeName): string {
  switch (type) {
    case 'bigint':
    case 'boolean':
    case 'buffer':
    case 'function':
    case 'map':
    case 'number':
    case 'promise':
    case 'regexp':
    case 'set':
    case 'string':
    case 'symbol':
      return `a <${type}>`

    case 'array':
    case 'object':
      return `an <${type}>`

    case 'null':
    case 'undefined':
      return `<${type}>`

    default:
      return `of unknown type <${type}>`
  }
}

/* ========================================================================== *
 * EXPECTATIONS MATCHERS MARKER                                               *
 * ========================================================================== */

export const matcherMarker = Symbol.for('plugjs:expect5:types:ExpectationsMatcher')

export function isMatcher(what: any): what is ExpectationsMatcher {
  return what && what[matcherMarker] === matcherMarker
}

/* ========================================================================== *
 * EXPECTATION ERRORS                                                         *
 * ========================================================================== */

export class ExpectationError extends Error {
  diff?: Diff | undefined

  /** Create an {@link ExpectationError} from a context and details message */
  constructor(context: ExpectationsContext, details: string)

  /**
   * Create an {@link ExpectationError} from a context and details message,
   * including an optional {@link Diff}
   */
  constructor(context: ExpectationsContext, details: string, diff?: Diff)

  /**
   * Create an {@link ExpectationError} from a context and details message,
   * optionally forcing _negation_ to be as specified.
   */
  constructor(context: ExpectationsContext, details: string, forcedNegative?: boolean)

  /**
   * Create an {@link ExpectationError} from a context and details message,
   * including an optional {@link Diff} and forcing _negation_ to be as
   * specified.
   */
  constructor(context: ExpectationsContext, details: string, diff?: Diff, forcedNegative?: boolean)

  /* Overloaded constructor implementation */
  constructor(
      context: ExpectationsContext,
      details: string,
      diffOrForcedNegative?: Diff | boolean,
      maybeForcedNegative?: boolean,
  ) {
    const diff = typeof diffOrForcedNegative === 'object' ? diffOrForcedNegative : null
    const negative =
      typeof diffOrForcedNegative === 'boolean' ? diffOrForcedNegative :
      typeof maybeForcedNegative === 'boolean' ? maybeForcedNegative :
      context._negative

    const { value } = context
    const not = negative ? ' not' : ''

    // if we're not root...
    let preamble = stringifyValue(value)
    if (context._parent) {
      const properties: any[] = []

      while (context._parent) {
        properties.push(`[${stringifyValue(context._parent.prop)}]`)
        context = context._parent.context
      }

      preamble = properties.reverse().join('')

      // type of root value is constructor without details
      const type = typeof context.value === 'object' ?
          stringifyObjectType(context.value as object) : // parent values can not be null!
          stringifyValue(context.value)

      // assemble the preamble
      preamble = `property ${preamble} of ${type} (${stringifyValue(value)})`
    }

    super(`Expected ${preamble}${not} ${details}`)

    if (diff) this.diff = diff
  }
}
