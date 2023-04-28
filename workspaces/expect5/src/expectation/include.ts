import { diff, type Diff } from './diff'
import { type Expectations } from './expectations'
import {
  ExpectationError,
  stringifyObjectType,
  stringifyValue,
} from './types'

/* === TO INCLUDE =========================================================== */

export function toInclude(
    expectations: Expectations,
    negative: boolean,
    contents:
    | Record<string, any>
    | Map<any, any>
    | Set<any>
    | any [],
): void {
  // get diff depending on type of "expected"
  if (contents instanceof Map) return includesMappings(expectations, negative, contents)
  if (contents instanceof Set) return includesValues(expectations, negative, contents)
  if (Array.isArray(contents)) return includesValues(expectations, negative, new Set(contents))
  if (contents instanceof Object) return includesProps(expectations, negative, contents)
  throw new TypeError(`Invalid type for "toInclude(...)": ${stringifyValue(contents)}`)
}

/* === TO MATCH CONTENTS ==================================================== */

export function toMatchContents(
    expectations: Expectations,
    contents: any[] | Set<any>,
): void {
  let actual: Set<any>
  let expected: Set<any>
  try {
    actual = new Set(expectations.value as any)
    expected = new Set(contents)
  } catch (error) {
    throw new ExpectationError(expectations, 'to be an iterable object')
  }

  const result = diff(actual, expected)
  delete result.error // remove extra error message about size differences...
  if (! result.diff) return

  throw new ExpectationError(expectations,
      `to match contents of ${stringifyObjectType(contents)}`,
      { ...result, value: expectations.value })
}

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

function includesProps(
    expectations: Expectations,
    negative: boolean,
    expected: Record<string, any>,
): void {
  // simple include for maps with objects...
  if (expectations.value instanceof Map) {
    return includesMappings(expectations, negative, new Map(Object.entries(expected)))
  }

  // we really need an object as actual
  expectations.toBeInstanceOf(Object)
  const actual: Record<string, any> = expectations.value as any

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
  const not = negative ? 'not ' : ''
  throw new ExpectationError(expectations, `${not}to include ${count} ${type}`, {
    diff: true,
    value: actual,
    props,
  })
}

function includesValues(
    expectations: Expectations,
    negative: boolean,
    expected: Set<any>,
): void {
  // we really need an _iterable_ object as actual
  expectations.toBeInstanceOf(Object)
  if (typeof (expectations.value as any)[Symbol.iterator] !== 'function') {
    throw new ExpectationError(expectations, 'to be an iterable object')
  }
  const actual = new Set(expectations.value as Iterable<any>)

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
  const not = negative ? 'not ' : ''
  throw new ExpectationError(expectations, `${not}to include ${count} ${type}`, {
    diff: true,
    value: expectations.value,
    values,
  })
}

function includesMappings(
    expectations: Expectations,
    negative: boolean,
    expected: Map<any, any>,
): void {
  const actual = expectations.toBeInstanceOf(Map).value

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
  const not = negative ? 'not ' : ''
  throw new ExpectationError(expectations, `${not}to include ${count} ${type}`, {
    diff: true,
    value: expectations.value,
    mappings,
  })
}
