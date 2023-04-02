import { inspect } from 'node:util'

import type { ExpectationContext } from './expect'

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
  regexp: RegExp,
  set: Set<any>,
  // object: anything not mapped above, not null, and not an array
  object: NonArrayObject<any>,
  // oh, javascript :-(
  null: null,
}

/** Values returned by our own _expanded_ `{@link typeOf}` */
export type TypeName = keyof TypeMappings

/** Determines if the specified `value` is of the specified _expanded_ `type` */
export function isType<T extends keyof TypeMappings>(
    context: ExpectationContext,
    type: T,
): context is ExpectationContext<TypeMappings[T]> {
  return typeOf(context.value) === type
}

/** Asserts that the specified `value` is of the specified _expanded_ `type` */
export function assertType<T extends keyof TypeMappings>(
    context: ExpectationContext,
    type: T,
): asserts context is ExpectationContext<TypeMappings[T]> {
  const { value } = context

  if (typeOf(value) === type) return

  context = { ...context, negative: false }
  throw new ExpectationError(context, `be ${prefixType(type)}`)
}

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
  if (Buffer.isBuffer(value)) return 'buffer'

  if (value instanceof RegExp) return 'regexp'
  if (value instanceof Map) return 'map'
  if (value instanceof Set) return 'set'

  // anything else is an object
  return 'object'
}

export class TypeFormat {
  constructor(private _format: string) {}

  toString(): string {
    return this._format
  }

  [inspect.custom](): string {
    return this._format
  }
}

/** Return the type of the value or (if an object) its constructor name */
export function typeFormat(value: unknown): TypeFormat { // TypeName | `[${string}]` {
  const type = typeOf(value)
  if (type !== 'object') return new TypeFormat(`<${type}>`)

  const proto = Object.getPrototypeOf(value)
  if (! proto) return new TypeFormat('[Object: null prototype]')

  const ctor = proto.constructor?.name
  if (! ctor) return new TypeFormat('[Object: null constructor]')

  if (ctor === 'Object') return new TypeFormat('<object>')
  return new TypeFormat(`[${ctor}]`)
}

/** Pretty print the value (strings, numbers, booleans) or return the type */
export function stringifyValue(value: unknown): string {
  const type = typeOf(value)
  switch (type) {
    case 'string':
      if ((value as string).length > 40) {
        value = (value as string).substring(0, 39) + '\u2026'
      } //
      return JSON.stringify(value)
    case 'number':
      if (isNaN(value as number)) return '<number:NaN>'
      if (value === Number.POSITIVE_INFINITY) return '<number:+Infinity>'
      if (value === Number.NEGATIVE_INFINITY) return '<number:-Infinity>'
      return String(value)
    case 'boolean':
      return String(value)
    case 'bigint':
      return `${value}n`
    default:
      return typeFormat(value).toString()
  }
}

/** Add the `a`/`an`/... prefix to the type name */
export function prefixType(type: TypeName): string {
  switch (type) {
    case 'bigint':
    case 'boolean':
    case 'function':
    case 'number':
    case 'string':
    case 'symbol':
    case 'buffer':
    case 'map':
    case 'regexp':
    case 'set':
      return `a <${type}>`

    case 'object':
    case 'array':
      return `an <${type}>`

    case 'undefined':
    case 'null':
      return `<${type}>`

    default:
      return `of type <${type}>`
  }
}

export class ExpectationError extends Error {
  readonly expectation: string

  constructor(
      context: ExpectationContext,
      details: string,
      cause?: Error,
  ) {
    const { value, negative, expectation, from } = context
    const not = negative ? ' not' : ''

    super(`Expected ${stringifyValue(value)}${not} to ${details}`, { cause })
    this.expectation = `${negative ? '!' : ''}${expectation}`

    Error.captureStackTrace(this, from)
  }
}
