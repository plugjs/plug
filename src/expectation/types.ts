import { inspect } from 'node:util'

import type { Expectations } from './expect'

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

/** A simple utility class for pretty-printing in messages and inspections */
export interface FormattedString { readonly string: string }

function formatString(string: string): FormattedString {
  return Object.defineProperties(Object.create(null), {
    [Symbol.toPrimitive]: { value: () => string },
    [inspect.custom]: { value: () => string },
    'toString': { value: () => string },
    // let this "enumerable" for assert.deepEqual
    'string': { value: string, enumerable: true },
  })
}

/** Return the type of the value or (if an object) its constructor name */
function stringifyType(
    value: unknown,
    prop?: string,
    propValue?: any,
    // ...[ prop, propValue ]: [] | [ prop: string, propValue: any ]
): FormattedString {
  const highlight = prop ? ` { ${prop}: ${stringifyValue(propValue)} }` : ''

  const type = typeOf(value)
  if (type !== 'object') return formatString(`<${type}>${highlight}`)

  const proto = Object.getPrototypeOf(value)
  if (! proto) return formatString(`[Object: null prototype]${highlight}`)
  const formatted = stringifyConstructor(proto.constructor)
  return formatString(`${formatted.string}${highlight}`)
}

/** Stringify a constructor */
export function stringifyConstructor(ctor: Constructor): FormattedString {
  if (ctor === Object) return formatString('<object>')
  if (! ctor) return formatString('[Object: no constructor]')
  if (! ctor.name) return formatString('[Object: anonymous]')
  return formatString(`[${ctor.name}]`)
}

/** Pretty print the value (strings, numbers, booleans) or return the type */
export function stringifyValue(
    value: unknown,
    ...[ prop, propValue ]: [] | [ prop: string, propValue: any ]
): FormattedString {
  // const type =
  switch (typeof value) {
    case 'string':
      if ((value as string).length > 40) {
        value = (value as string).substring(0, 39) + '\u2026'
      } //
      return formatString(JSON.stringify(value))
    case 'number':
      if (isNaN(value as number)) return formatString('<number:NaN>')
      if (value === Number.POSITIVE_INFINITY) return formatString('<number:+Infinity>')
      if (value === Number.NEGATIVE_INFINITY) return formatString('<number:-Infinity>')
      return formatString(String(value))
    case 'boolean':
      return formatString(String(value))
    case 'bigint':
      return formatString(`${value}n`)
    case 'function':
      return formatString(value.name ? `<function ${value.name}>` : '<function>')
    case 'symbol':
      return formatString(value.description ? `<symbol ${value.description}>`: '<symbol>')
  }

  // null, undefined, ...
  if (! value) return stringifyType(value, prop, propValue)

  // specific object types
  if (value instanceof RegExp) return formatString(String(value))

  // default: stringify type...
  return stringifyType(value, prop, propValue)
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

/* ========================================================================== *
 * EXPECTATION ERRORS                                                         *
 * ========================================================================== */

export class ExpectationError extends Error {
  constructor(
      context: Expectations,
      negative: boolean,
      details: string,
  ) {
    const { value } = context
    const not = negative ? ' not' : ''

    // if we're not root...
    let preamble = stringifyValue(value).string
    if (context.parent) {
      const properties: any[] = []

      while (context.parent) {
        const prop = context.parent.prop
        properties.push(
          typeof prop === 'string' ?
            `[${JSON.stringify(prop)}]` :
            `[${String(prop)}]`,
        )
        context = context.parent.context
      }

      preamble = properties.reverse().join('')
      preamble = `property ${preamble} of ${stringifyValue(context.value)} (${stringifyValue(value)})`
    }

    super(`Expected ${preamble}${not} ${details}`)
  }
}
