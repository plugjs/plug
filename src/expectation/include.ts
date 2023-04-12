import { diff } from './diff'
import { ExpectationError, stringifyValue } from './types'

import type { Diff } from './diff'
import type { Expectation, Expectations } from './expect'

export class ToInclude implements Expectation {
  expect(
      context: Expectations,
      negative: boolean,
      expected:
      | Record<string, any>
      | Map<any, any>
      | Set<any>
      | any [],
  ): void {
    // get diff depending on type of "expected"
    if (expected instanceof Map) return includesMappings(context, negative, expected)
    if (expected instanceof Set) return includesValues(context, negative, expected)
    if (Array.isArray(expected)) return includesValues(context, negative, new Set(expected))
    if (expected instanceof Object) return includesProps(context, negative, expected)
    throw new TypeError(`Invalid type for "toInclude(...)": ${stringifyValue(expected)}`)
  }
}

export function includesProps(context: Expectations, negative: boolean, expected: Record<string, any>): void {
  // simple include for maps with objects...
  if (context.value instanceof Map) {
    return includesMappings(context, negative, new Map(Object.entries(expected)))
  }

  //
  context.toBeInstanceOf(Object)
  const actual: Record<string, any> = context.value as any

  // Get expected key set and process...
  const keys = new Set(Object.keys(expected))
  const props: Record<string, Diff> = {}

  if (negative) {
    // only consider keys... if they exist, fail!
    for (const key of keys) {
      if ((actual[key] !== undefined) || (key in actual)) {
        props[key] = {
          diff: true,
          actual: stringifyValue(actual[key]),
          expected: stringifyValue(undefined),
        }
      }
    }
  } else {
    for (const key of keys) {
      const difference = diff(actual[key], expected[key])
      if (! difference.diff) continue
      props[key] = difference
    }
  }

  const count = Object.keys(props).length
  if (count === 0) return // no props? no errors!

  const type = count === 1 ? 'property' : 'properties'
  throw new ExpectationError(context, negative, `to include ${count} ${type}`, {
    diff: true,
    actual: stringifyValue(actual),
    props,
  })
}

export function includesValues(context: Expectations, negative: boolean, expected: Set<any>): void {
  void context, negative, expected
  throw new Error()
}

export function includesMappings(context: Expectations, negative: boolean, expected: Map<any, any>): void {
  context.toBeInstanceOf(Map)
  const actual: Map<any, any> = context.value as any

  // Get expected key set and process...
  const keys = new Set(expected.keys())
  const mappings: [ string, Diff ][] = []

  if (negative) {
    // only consider keys... if they exist, fail!
    for (const key of keys) {
      if (actual.has(key)) {
        mappings.push([
          stringifyValue(key), {
            diff: true,
            actual: stringifyValue(actual.get(key)),
            expected: stringifyValue(undefined),
          } ])
      }
    }
  } else {
    for (const key of keys) {
      const difference = diff(actual.get(key), expected.get(key))
      if (! difference.diff) continue
      mappings.push([ stringifyValue(key), difference ])
    }
  }

  const count = mappings.length
  if (count === 0) return // no mappings? no errors!

  const type = count === 1 ? 'mapping' : 'mappings'
  throw new ExpectationError(context, negative, `to include ${count} ${type}`, {
    diff: true,
    actual: stringifyValue(actual),
    mappings,
  })
}
