import type { Diff } from './diff'
import type { Expectations, ExpectationsMatcher } from './expect'

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

/** A type identifying the parameter of `string.match(...)` */
export type StringMatcher = string | RegExp | {
  [Symbol.match](string: string): RegExpMatchArray | null
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

/** Determines if the specified `value` is of the specified _expanded_ `type` */
export function isType<T extends keyof TypeMappings>(
    context: Expectations,
    type: T,
): context is Expectations<TypeMappings[T]> {
  return typeOf(context.value) === type
}

/** Asserts that the specified `value` is of the specified _expanded_ `type` */
export function assertType<T extends keyof TypeMappings>(
    context: Expectations,
    type: T,
): asserts context is Expectations<TypeMappings[T]> {
  const { value } = context

  if (typeOf(value) === type) return

  throw new ExpectationError(context, false, `to be ${prefixType(type)}`)
}

/* ========================================================================== *
 * PRETTY PRINTING FOR MESSAGES AND DIFFS                                     *
 * ========================================================================== */

/** Stringify a constructor */
export function stringifyConstructor(ctor: Constructor): string {
  if (! ctor) return '[Object: no constructor]'
  if (! ctor.name) return '[Object: anonymous]'
  return `[${ctor.name}]`
}

/** Default inspector for {@link stringifyValue} */
function defaultInspector(value: any): string {
  const proto = Object.getPrototypeOf(value)
  if (! proto) return '[Object: null prototype]'
  return stringifyConstructor(proto.constructor)
}

/** Get constructor name or default for {@link stringifyValue} */
function constructorName(value: any, clazz: Constructor): string {
  return Object.getPrototypeOf(value)?.constructor?.name || clazz.name
}

/** Format binary data for {@link stringifyValue} */
function formatBinaryData(value: any, clazz: Constructor, buffer: Buffer): string {
  const binary = buffer.length > 20 ?
      `${buffer.toString('hex', 0, 20)}\u2026, length=${value.length}` :
      buffer.toString('hex')
  return binary ?
      `[${constructorName(value, clazz)}: ${binary}]` :
      `[${constructorName(value, clazz)}: empty]`
}

/** Pretty print the value (strings, numbers, booleans) or return the type */
export function stringifyValue(
    value: unknown,
    inspector: (value: any) => string = defaultInspector,
): string {
  // null, undefined, ...
  if (value === null) return '<null>'
  if (value === undefined) return '<undefined>'

  // basic types
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
  if (value instanceof Date) return `[${constructorName(value, Date)}: ${value.toISOString()}]`
  if (value instanceof Boolean) return `[${constructorName(value, Boolean)}: ${value.valueOf()}]`
  if (value instanceof Number) return `[${constructorName(value, Number)}: ${stringifyValue(value.valueOf())}]`
  if (value instanceof String) return `[${constructorName(value, String)}: ${stringifyValue(value.valueOf())}]`

  if (Array.isArray(value)) return `[${constructorName(value, Array)} (${value.length})]`
  if (value instanceof Set) return `[${constructorName(value, Set)} (${value.size})]`
  if (value instanceof Map) return `[${constructorName(value, Map)} (${value.size})]`

  if (value instanceof Buffer) return formatBinaryData(value, Buffer, value)
  if (value instanceof Uint8Array) return formatBinaryData(value, Uint8Array, Buffer.from(value))
  if (value instanceof ArrayBuffer) return formatBinaryData(value, ArrayBuffer, Buffer.from(value))
  if (value instanceof SharedArrayBuffer) return formatBinaryData(value, SharedArrayBuffer, Buffer.from(value))

  // inspect anything else...
  return inspector(value)
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

export const matcherMarker = Symbol.for('expect5.matcher')

export function isMatcher(what: any): what is ExpectationsMatcher {
  return what && what[matcherMarker] === matcherMarker
}

/* ========================================================================== *
 * EXPECTATION ERRORS                                                         *
 * ========================================================================== */

export class ExpectationError extends Error {
  diff?: Diff | undefined

  constructor(
      context: Expectations,
      negative: boolean,
      details: string,
      diff?: Diff,
  ) {
    const { value } = context
    const not = negative ? ' not' : ''

    // if we're not root...
    let preamble = stringifyValue(value)
    if (context.parent) {
      const properties: any[] = []

      while (context.parent) {
        properties.push(`[${stringifyValue(context.parent.prop)}]`)
        context = context.parent.context
      }

      preamble = properties.reverse().join('')

      // type of root value is constructor without details
      let type: string
      switch (typeof context.value) {
        case 'bigint':
        case 'boolean':
        case 'function':
        case 'number':
        case 'string':
        case 'symbol':
        case 'undefined':
          type = stringifyValue(context.value)
          break
        default:
          type = context.value === null ?
              stringifyValue(context.value) :
              defaultInspector(context.value)
      }

      // assemble the preamble
      preamble = `property ${preamble} of ${type} (${stringifyValue(value)})`
    }

    super(`Expected ${preamble}${not} ${details}`)

    if (diff) this.diff = diff
  }
}
