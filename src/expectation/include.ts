import { diff } from './diff'
import { ExpectationError, stringifyValue } from './types'

import type { MappingsDiff, ObjectDiff } from './diff'
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
  context.toBeInstanceOf(Object)
  const actual: Record<string, any> = context.value as any

  // Initial diff
  const result: Required<ObjectDiff> = {
    diff: false,
    actual: stringifyValue(actual),
    props: {},
  }

  // Get expected key set and process...
  const keys = new Set(Object.keys(expected))

  if (negative) {
    // only consider keys... if they exist, fail!
    for (const key of keys) {
      if ((actual[key] !== undefined) || (key in actual)) {
        result.diff = true
        result.props[key] = {
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
      result.props[key] = difference
      result.diff = true
    }
  }

  if (! result.diff) return
  const message = `to include properties from ${stringifyValue(expected)}`
  throw new ExpectationError(context, negative, message, result)
}

export function includesValues(context: Expectations, negative: boolean, expected: Set<any>): void {
  void context, negative, expected
  throw new Error()
}

export function includesMappings(context: Expectations, negative: boolean, expected: Map<any, any>): void {
  context.toBeInstanceOf(Map)
  const actual: Map<any, any> = context.value as any

  // Initial diff
  const result: MappingsDiff = {
    diff: false,
    actual: stringifyValue(actual),
    mappings: [],
  }

  // Get expected key set and process...
  const keys = new Set(expected.keys())

  if (negative) {
    // only consider keys... if they exist, fail!
    for (const key of keys) {
      if (actual.has(key)) {
        result.diff = true
        result.mappings.push([
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
      result.mappings.push([ stringifyValue(key), difference ])
      result.diff = true
    }
  }

  if (! result.diff) return
  const message = `to include mappings from ${stringifyValue(expected)}`
  throw new ExpectationError(context, negative, message, result)
}
