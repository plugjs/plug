/* eslint-disable no-fallthrough */
import {
  ExpectationError,
  isMatcher,
  stringifyConstructor,
  stringifyValue,
} from './types'

import type { Constructor } from './types'

export interface BaseDiff {
  diff: boolean,
  error?: string,
}

export interface ValueDiff extends BaseDiff {
  value: any,
}

export interface ExpectedDiff extends ValueDiff {
  diff: true,
  expected: any,
}

export interface ExtraValueDiff extends BaseDiff {
  diff: true,
  extra: any,
}

export interface MissingValueDiff extends BaseDiff {
  diff: true,
  missing: any,
}

export interface ObjectDiff extends ValueDiff {
  diff: boolean,
  props?: Record<string, Diff>,
  values?: Diff[],
  mappings?: [ any, Diff ][]
}

export type Diff =
  | ValueDiff
  | ExpectedDiff
  | ObjectDiff
  | ExtraValueDiff
  | MissingValueDiff

/* ========================================================================== *
 * IMPLEMENTATION INTERNALS                                                   *
 * ========================================================================== */

type Binary = Buffer | Uint8Array | ArrayBuffer | SharedArrayBuffer
type BoxedPrimitive = Boolean | String | Number
type Remarks = { actualMemos: any[], expectedMemos: any[], strict: boolean }

/* ========================================================================== */

/** Find all enumerable keys of a number of objects */
function findEnumerableKeys(...objects: object[]): Set<string> {
  const keys = new Set<string>()
  for (const object of objects) {
    for (const key in object) {
      keys.add(key)
    }
  }

  return keys
}

/* ========================================================================== */

/** Compare two numbers, making NaNs equivalent */
function isSameNumberOrBothNaN(a: number, b: number): boolean {
  return a === b ? true : isNaN(a) ? isNaN(b) : false
}

/* ========================================================================== */

function errorDiff(value: any, message: string): ValueDiff {
  const error = `Expected ${stringifyValue(value)} ${message}`
  return { diff: true, value, error }
}

/* ========================================================================== */

function objectDiff<T extends Record<string, any>>(
    actual: T,
    expected: T,
    remarks: Remarks,
    keys?: Set<string>,
): ObjectDiff | ValueDiff {
  // default keys: all keys from both actual and expected objects
  if (! keys) keys = findEnumerableKeys(actual, expected)

  // no keys? no diff!
  if (! keys.size) return { diff: false, value: actual }

  // evaluate differences between objects
  let diff = false
  const props: Record<string, Diff> = {}
  for (const key of keys) {
    const act = actual[key]
    const exp = expected[key]

    // check for missing/extra property or differences
    let result: Diff
    if ((act === undefined) && (exp === undefined) && (!(key in expected)) && (! remarks.strict)) {
      result = { diff: false, value: undefined }
    } else if ((key in expected) && (!(key in actual))) {
      result = { diff: true, missing: exp }
    } else if ((key in actual) && (!(key in expected))) {
      result = { diff: true, extra: act }
    } else {
      result = diffValues(act, exp, remarks)
    }

    props[key] = result
    diff ||= result.diff
  }

  // return our differences
  return { diff, value: actual, props }
}

/* ========================================================================== */

function arrayDiff<T extends Record<number, any> & { length: number }>(
    actual: T,
    expected: T,
    remarks: Remarks,
): ObjectDiff {
  // make sure that the length of both arrays is the same
  if (actual.length !== expected.length) {
    return errorDiff(actual, `to have length ${expected.length} (length=${actual.length})`)
  }

  // prepare a set with _all_ keys from both expected and actual object
  const keys = findEnumerableKeys(actual, expected)

  // iterate through the array, checking equality for each item ad the given
  // index, and _removing_ the index from the set of keys to further analyse
  let valuesDiff = false
  const values = new Array<Diff>(expected.length)
  for (let i = 0; i < expected.length; i ++) {
    const result = values[i] = diffValues(actual[i], expected[i], remarks)
    valuesDiff = valuesDiff || result.diff
    keys.delete(String(i))
  }

  // analyse the differences between leftover props (if any)
  const result = objectDiff(actual, expected, remarks, keys)
  const diff = result.diff || valuesDiff

  // all done!
  return { ...result, diff, values }
}

/* ========================================================================== */

function setDiff<T>(
    actual: Set<T>,
    expected: Set<T>,
    remarks: Remarks,
): ObjectDiff {
  // highlight if sets have different sizes... don't expand the returned error
  // as this might inject an extra "error: undefined" property in the final diff
  const error = actual.size === expected.size ? {} :
    errorDiff(actual, `to have size ${expected.size} (size=${actual.size})`)

  // check differences between sets
  const values: Diff[] = []
  const missing = new Set<T>(expected)
  const extra = new Set<T>(actual)

  for (const act of extra) {
    for (const exp of missing) {
      const diff = diffValues(act, exp, remarks)
      if (diff.diff) continue

      values.push(diff)
      extra.delete(act)
      missing.delete(exp)
    }
  }

  // compare sets as "objects" (for extra properties)
  const result = objectDiff(actual, expected, remarks)
  const diff = !! (missing.size || extra.size || result.diff)

  // inject all extra and missing properties
  extra.forEach((value) => values.push({ diff: true, extra: value }))
  missing.forEach((value) => values.push({ diff: true, missing: value }))

  // done...
  return { ...error, ...result, diff, values }
}

/* ========================================================================== */

function mapDiff<K, V>(
    actual: Map<K, V>,
    expected: Map<K, V>,
    remarks: Remarks,
): ObjectDiff {
  // check mappings
  let diff = false
  const mappings: [ any, Diff ][] = []
  for (const key of new Set([ ...actual.keys(), ...expected.keys() ])) {
    const act = actual.get(key)
    const exp = expected.get(key)

    if (! actual.has(key)) {
      mappings.push([ key, { diff: true, missing: exp } ])
      diff = true
    } else if (! expected.has(key)) {
      mappings.push([ key, { diff: true, extra: act } ])
      diff = true
    } else {
      const result = diffValues(act, exp, remarks)
      mappings.push([ key, result ])
      diff = diff || result.diff
    }
  }

  // check other properties
  const result = objectDiff(actual, expected, remarks)
  diff = diff || result.diff

  // done...
  return { ...result, diff, mappings }
}

/* ========================================================================== */

function binaryDiff<T extends Binary>(
    actual: T,
    expected: T,
    actualData: Buffer,
    expectedData: Buffer,
    remarks: Remarks,
): ObjectDiff | ValueDiff {
  // make sure that the length of both arrays is the same
  if (actualData.length !== expectedData.length) {
    return errorDiff(actual, `to have length ${expectedData.length} (length=${actualData.length})`)
  }

  // remember keys
  const keys = findEnumerableKeys(actual, expected)
  // buffers have a ton of *enumerable* props we don't want to consider...
  if (actual instanceof Buffer) {
    for (const key in Buffer.prototype) {
      keys.delete(key)
    }
  }

  // check for equality
  const length = expectedData.length
  for (let i = 0; i < length; i ++) {
    keys.delete(String(i))
    if (actualData[i] === expectedData[i]) continue

    let act = actualData.toString('hex', i, i + 6)
    let exp = expectedData.toString('hex', i, i + 6)
    if (act.length > 10) {
      act = act.substring(0, 10) + '\u2026'
      exp = exp.substring(0, 10) + '\u2026'
    }
    if (i > 0) {
      act = '\u2026' + act
      exp = '\u2026' + exp
    }

    return errorDiff(actual, `to equal at index ${i} (actual=${act}, expected=${exp})`)
  }

  // same contents, check extra properties
  return objectDiff(actual, expected, remarks, keys)
}

/* ========================================================================== */

function primitiveDiff<T extends BoxedPrimitive>(
    actual: T,
    expected: T,
    remarks: Remarks,
): ObjectDiff | ExpectedDiff | ValueDiff {
  if (actual.valueOf() !== expected.valueOf()) {
    return {
      diff: true,
      value: actual,
      expected: expected,
    }
  }

  // remove string indexes from properties
  const keys = findEnumerableKeys(actual, expected)
  if (actual instanceof String) {
    const length = actual.valueOf().length
    for (let i = 0; i < length; i ++) {
      keys.delete(String(i))
    }
  }

  // return either an object diff or no diff at all...
  return keys.size ? objectDiff(actual, expected, remarks, keys) : {
    diff: false,
    value: actual,
  }
}

/* ========================================================================== *
 * MAIN "DIFF"                                                                *
 * ========================================================================== */

function diffValues(actual: any, expected: any, remarks: Remarks): Diff {
  // strict equality
  if (expected === actual) return { diff: false, value: expected }

  // oh, javascript!
  if (expected === null) {
    return {
      diff: true,
      value: actual,
      expected: null,
    }
  }

  // matchers!
  if (isMatcher(expected)) {
    try {
      expected.expect(actual)
      return { diff: false, value: actual }
    } catch (error) {
      if (error instanceof ExpectationError) {
        // if the error highlights a difference, simply return that
        // otherwise wrap the error into a new ErrorDiff and return it
        const { message, diff } = error
        return diff?.diff ? diff : { diff: true, value: actual, error: message }
      } else {
        throw error
      }
    }
  }

  // inspect types of what to compare
  const actualType = typeof actual
  const expectedType = typeof expected

  // if type is different then highlight the difference
  if (actualType !== expectedType) {
    return {
      diff: true,
      value: actual,
      expected: expected,
    }
  }

  // primitives
  switch (actualType) {
    // numbers are one-of-a-kind as NaN !== NaN
    case 'number':
      if (isSameNumberOrBothNaN(actual, expected)) {
        return { diff: false, value: NaN }
      }
    // primitives always must be strict ===
    case 'bigint':
    case 'boolean':
    case 'function':
    case 'string':
    case 'symbol':
    case 'undefined':
      return {
        diff: true,
        value: actual,
        expected: expected,
      }
    // everything else is an object and must be checked
  }

  // check for cyclical dependencies, see node's commit here:
  // https://github.com/nodejs/node/commit/d3aafd02efd3a403d646a3044adcf14e63a88d32
  const actualIndex = remarks.actualMemos.indexOf(actual)
  if (actualIndex !== -1) {
    if (actualIndex === remarks.expectedMemos.indexOf(expected)) {
      return { diff: false, value: actual }
    }
  }

  remarks.actualMemos.push(actual)
  remarks.expectedMemos.push(expected)

  // check that actual is _assignable_ from expected
  const prototype = Object.getPrototypeOf(expected)
  if (prototype && prototype.constructor) {
    if (! (actual instanceof prototype.constructor)) {
      return {
        ...errorDiff(actual, `to be instance of ${stringifyConstructor(prototype.constructor)}`),
        diff: true,
        expected,
      }
    }
  }

  /* == ARRAYS ============================================================== */

  const checkInstance = <T>(
    ctor: Constructor<T>,
    callback: (actual: T, expected: T, remarks: Remarks) => Diff,
  ): Diff | undefined =>
    (expected instanceof ctor) ?
      callback(actual as InstanceType<typeof ctor>, expected, remarks) :
    (actual instanceof ctor) ?
      { diff: true, value: actual, expected } :
    undefined

  return (
    /* == ARRAYS ============================================================ */
    checkInstance(Array, arrayDiff) ||

    /* == SETS ============================================================== */
    checkInstance(Set, (act, exp) => setDiff(act, exp, remarks)) ||

    /* == MAPS ============================================================== */
    checkInstance(Map, (act, exp) => mapDiff(act, exp, remarks)) ||

    /* == BOXED PRIMITIVES ================================================== */
    checkInstance(Boolean, primitiveDiff) ||
    checkInstance(String, primitiveDiff) ||
    checkInstance(Number, primitiveDiff) ||

    /* == PROMISES (always error, must be ===) ============================== */
    checkInstance(Promise, (act, exp) => errorDiff(act, `to strictly equal ${stringifyValue(exp)}`)) ||

    /* == DATES ============================================================= */
    checkInstance(Date, (act, exp) =>
      (! isSameNumberOrBothNaN(act.getTime(), exp.getTime())) ? {
        diff: true,
        value: act,
        expected: exp,
      } : objectDiff(act, exp, remarks)) ||

    /* == REGULAR EXPRESSIONS =============================================== */
    checkInstance(RegExp, (act, exp) =>
      ((act.source !== exp.source) || (act.flags !== exp.flags)) ? {
        diff: true,
        value: act,
        expected: exp,
      } : objectDiff(act, exp, remarks)) ||

    /* == BINARY ARRAYS ===================================================== */
    checkInstance(Buffer, (act, exp) => binaryDiff(act, exp, act, exp, remarks)) ||
    checkInstance(Uint8Array, (act, exp) => binaryDiff(act, exp, Buffer.from(act), Buffer.from(exp), remarks)) ||
    checkInstance(ArrayBuffer, (act, exp) => binaryDiff(act, exp, Buffer.from(act), Buffer.from(exp), remarks)) ||
    checkInstance(SharedArrayBuffer, (act, exp) => binaryDiff(act, exp, Buffer.from(act), Buffer.from(exp), remarks)) ||

    /* == OTHER TYPED ARRAYS ================================================ */
    checkInstance(BigInt64Array, arrayDiff) ||
    checkInstance(BigUint64Array, arrayDiff) ||
    checkInstance(Float32Array, arrayDiff) ||
    checkInstance(Float64Array, arrayDiff) ||
    checkInstance(Int16Array, arrayDiff) ||
    checkInstance(Int32Array, arrayDiff) ||
    checkInstance(Int8Array, arrayDiff) ||
    checkInstance(Uint16Array, arrayDiff) ||
    checkInstance(Uint32Array, arrayDiff) ||
    checkInstance(Uint8ClampedArray, arrayDiff) ||

    /* == DONE ============================================================== */
    objectDiff(actual as any, expected, remarks))
}

/* ========================================================================== *
 * EXPORTS                                                                    *
 * ========================================================================== */

export function diff(actual: any, expected: any, strict: boolean = false): Diff {
  return diffValues(actual, expected, { actualMemos: [], expectedMemos: [], strict })
}
