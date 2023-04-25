import { diff } from './diff'
import { ExpectationError, stringifyObjectType, stringifyValue } from './types'

import type { Diff } from './diff'
import type { Expectations, ExpectationsContext, JoinExpectations } from './expect'

/* === TO INCLUDE =========================================================== */

/** Expect the value to include _all_ properties from the specified _object_. */
function toInclude<T, P extends Record<string, any>>(this: T, properties: P): JoinExpectations<T, P>
/** Expect the value to include _all_ mappings from the specified {@link Map}. */
function toInclude<T>(this: T, mappings: Map<any, any>): T
/** Expect the value to include _all_ values from the specified {@link Set}. */
function toInclude<T>(this: T, entries: Set<any>): T
/** Expect the value to include _all_ values in any order from the specified _array_. */
function toInclude<T>(this: T, values: any[]): T

/* Overloaded function implementation */
function toInclude(
    this: ExpectationsContext,
    expected:
    | Record<string, any>
    | Map<any, any>
    | Set<any>
    | any [],
): Expectations {
  // get diff depending on type of "expected"
  if (expected instanceof Map) return includesMappings(this, expected)
  if (expected instanceof Set) return includesValues(this, expected)
  if (Array.isArray(expected)) return includesValues(this, new Set(expected))
  if (expected instanceof Object) return includesProps(this, expected)
  throw new TypeError(`Invalid type for "toInclude(...)": ${stringifyValue(expected)}`)
}

/* === TO MATCH CONTENTS ==================================================== */

/**
 * Expect the value to include _all_ values (and only those values, in any
 * order) from the specified _array_.
 */
function toMatchContents<T>(this: T, contents: any[]): T
/**
 * Expect the value to include _all_ values (and only those values, in any
 * order) from the specified {@link Set}.
 */
function toMatchContents<T>(this: T, contents: Set<any>): T

/* Overloaded function implementation */
function toMatchContents(
    this: ExpectationsContext,
    contents: any[] | Set<any>,
): Expectations {
  let actual: Set<any>
  let expected: Set<any>
  try {
    actual = new Set(this.value as any)
    expected = new Set(contents)
  } catch (error) {
    throw new ExpectationError(this, 'to be an iterable object', false)
  }

  const result = diff(actual, expected)
  delete result.error // remove extra error message about size differences...
  if (result.diff === this._negative) return this._expectations
  throw new ExpectationError(this,
      `to match contents of ${stringifyObjectType(contents)}`,
      { ...result, value: this.value })
}

/* === EXPORTS ============================================================== */

export {
  toInclude,
  toMatchContents,
}

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

function includesProps(context: ExpectationsContext, expected: Record<string, any>): Expectations {
  // simple include for maps with objects...
  if (context.value instanceof Map) {
    return includesMappings(context, new Map(Object.entries(expected)))
  }

  // we really need an object as actual
  context._expectations.toBeInstanceOf(Object)
  const actual: Record<string, any> = context.value as any

  // get expected key set and process...
  const keys = new Set(Object.keys(expected))
  const props: Record<string, Diff> = {}

  if (context._negative) {
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
  if (count === 0) return context._expectations // no props? no errors!

  const type = count === 1 ? 'property' : 'properties'
  throw new ExpectationError(context, `to include ${count} ${type}`, {
    diff: true,
    value: actual,
    props,
  })
}

function includesValues(context: ExpectationsContext, expected: Set<any>): Expectations {
  // we really need an _iterable_ object as actual
  context._expectations.toBeInstanceOf(Object)
  if (typeof (context.value as any)[Symbol.iterator] !== 'function') {
    throw new ExpectationError(context, 'to be an iterable object', false)
  }
  const actual = new Set(context.value as Iterable<any>)

  // iterate through all the values and see what we can find
  const values: Diff[] = []
  if (context._negative) {
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
  if (count === 0) return context._expectations // no values? no errors!

  const type = count === 1 ? 'value' : 'values'
  throw new ExpectationError(context, `to include ${count} ${type}`, {
    diff: true,
    value: context.value,
    values,
  })
}

function includesMappings(context: ExpectationsContext, expected: Map<any, any>): Expectations {
  context._expectations.toBeInstanceOf(Map)
  const actual: Map<any, any> = context.value as any

  // Get expected key set and process...
  const keys = new Set(expected.keys())
  const mappings: [ string, Diff ][] = []

  if (context._negative) {
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
  if (count === 0) return context._expectations // no mappings? no errors!

  const type = count === 1 ? 'mapping' : 'mappings'
  throw new ExpectationError(context, `to include ${count} ${type}`, {
    diff: true,
    value: context.value,
    mappings,
  })
}
