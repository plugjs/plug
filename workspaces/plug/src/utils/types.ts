/** A type adding the values `null` or `array` to the result of `typeof` */
export type BasicType =
  | 'string' | 'number' | 'bigint' | 'boolean' | 'symbol'
  | 'undefined' | 'object' | 'function' | 'null' | 'array'

/** Get the _real_ type of a value, including `null` or `array` */
export function getTypeOf(what: unknown): BasicType {
  if (Array.isArray(what)) return 'array'
  if (what === null) return 'null'
  return typeof what
}
