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

export class ToMatchContents implements Expectation {
  expect(
      context: Expectations,
      negative: boolean,
      contents: any[] | Set<any>,
  ): void {
    let actual: Set<any>
    let expected: Set<any>
    try {
      actual = new Set(context.value as any)
      expected = new Set(contents)
    } catch (error) {
      throw new ExpectationError(context, false, 'to be an iterable object')
    }

    const result = diff(actual, expected)
    if (result.diff === negative) return
    throw new ExpectationError(
        context,
        negative,
        `to match contents of ${stringifyValue(contents)}`,
        { ...result, value: context.value })
  }
}

export function includesProps(context: Expectations, negative: boolean, expected: Record<string, any>): void {
  // simple include for maps with objects...
  if (context.value instanceof Map) {
    return includesMappings(context, negative, new Map(Object.entries(expected)))
  }

  // we really need an object as actual
  context.toBeInstanceOf(Object)
  const actual: Record<string, any> = context.value as any

  // get expected key set and process...
  const keys = new Set(Object.keys(expected))
  const props: Record<string, Diff> = {}

  if (negative) {
    // only consider keys... if they exist, fail!
    for (const key of keys) {
      if ((actual[key] !== undefined) || (key in actual)) {
        props[key] = { diff: true, extra: actual[key] }
      }
    }
  } else {
    for (const key of keys) {
      const act = actual[key]
      const exp = expected[key]

      const result = diff(act, exp)
      if (! result.diff) continue

      // if there is a difference, we _might_ have a missing/extra property
      if ((act === undefined) && (! (key in actual))) {
        props[key] = { diff: true, missing: exp }
      } else {
        props[key] = result
      }
    }
  }

  const count = Object.keys(props).length
  if (count === 0) return // no props? no errors!

  const type = count === 1 ? 'property' : 'properties'
  throw new ExpectationError(context, negative, `to include ${count} ${type}`, {
    diff: true,
    value: actual,
    props,
  })
}

export function includesValues(context: Expectations, negative: boolean, expected: Set<any>): void {
  // we really need an _iterable_ object as actual
  context.toBeInstanceOf(Object)
  if (typeof (context.value as any)[Symbol.iterator] !== 'function') {
    throw new ExpectationError(context, false, 'to be an iterable object')
  }
  const actual = new Set(context.value as Iterable<any>)

  // iterate through all the values and see what we can find
  const values: Diff[] = []
  if (negative) {
    for (const exp of expected) {
      for (const act of actual) {
        const result = diff(act, exp)
        if (result.diff) continue

        values.push({ diff: true, extra: act })
        break
      }
    }
  } else {
    for (const exp of expected) {
      let found = false

      for (const act of actual) {
        const result = diff(act, exp)
        if (result.diff) continue
        found = true
        break
      }

      if (! found) {
        values.push({ diff: true, missing: exp })
      }
    }
  }

  const count = values.length
  if (count === 0) return // no values? no errors!

  const type = count === 1 ? 'value' : 'values'
  throw new ExpectationError(context, negative, `to include ${count} ${type}`, {
    diff: true,
    value: context.value,
    values,
  })
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
        mappings.push([ key, { diff: true, extra: actual.get(key) } ])
      }
    }
  } else {
    for (const key of keys) {
      if (! actual.has(key)) {
        mappings.push([ key, { diff: true, missing: expected.get(key) } ])
      } else {
        const result = diff(actual.get(key), expected.get(key))
        if (result.diff) mappings.push([ key, result ])
      }
    }
  }

  const count = mappings.length
  if (count === 0) return // no mappings? no errors!

  const type = count === 1 ? 'mapping' : 'mappings'
  throw new ExpectationError(context, negative, `to include ${count} ${type}`, {
    diff: true,
    value: context.value,
    mappings,
  })
}
