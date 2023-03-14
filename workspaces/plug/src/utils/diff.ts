import { fail } from 'node:assert'
import { isDeepStrictEqual } from 'node:util'

import { assert } from '../asserts'
import { $grn, $red, logOptions } from '../logging'

/* ========================================================================== *
 * EXPORTED INTERFACES                                                        *
 * ========================================================================== */

/** Identifies a single change */
export interface Change {
  /** The position in the Left-Hand side where items were deleted */
  lhsPos: number;
  /** The number of items deleted from the Left-Hand side */
  lhsDel: number;
  /** The position in the Right-Hand side where items were added */
  rhsPos: number;
  /** The number of items added to the Right-Hand side */
  rhsAdd: number;
}

/* ========================================================================== *
 * MYERS IMPLEMENTATION                                                       *
 * Lifted from https://github.com/wickedest/myers-diff/ (Apache 2.0)          *
 * ========================================================================== */

function compareLongestCommonSubsequence(lhsCtx: Context, rhsCtx: Context): Change[] {
  let lhsStart = 0
  let rhsStart = 0
  let lhsItem = 0
  let rhsItem = 0

  const changes: Change[] = []

  while (lhsItem < lhsCtx.length || rhsItem < rhsCtx.length) {
    if (
      (lhsItem < lhsCtx.length) && (!lhsCtx.modified[lhsItem]) &&
      (rhsItem < rhsCtx.length) && (!rhsCtx.modified[rhsItem])
    ) {
      // equal lines
      lhsItem++
      rhsItem++
      continue
    }

    // maybe deleted and/or inserted lines
    lhsStart = lhsItem
    rhsStart = rhsItem

    while ((lhsItem < lhsCtx.length) &&
      (rhsItem >= rhsCtx.length || lhsCtx.modified[lhsItem])) {
      lhsItem++
    }

    while ((rhsItem < rhsCtx.length) &&
      (lhsItem >= lhsCtx.length || rhsCtx.modified[rhsItem])) {
      rhsItem++
    }

    if ((lhsStart < lhsItem) || (rhsStart < rhsItem)) {
      const lat = Math.min(lhsStart, (lhsCtx.length) ? lhsCtx.length - 1 : 0)
      const rat = Math.min(rhsStart, (rhsCtx.length) ? rhsCtx.length - 1 : 0)

      changes.push({
        lhsPos: lat,
        lhsDel: lhsItem - lhsStart,
        rhsPos: rat,
        rhsAdd: rhsItem - rhsStart,
      })
    }
  }

  return changes
}

function getShortestMiddleSnake(
    lhsCtx: Context, lhsLower: number, lhsUpper: number,
    rhsCtx: Context, rhsLower: number, rhsUpper: number,
    vectorU: number[], vectorD: number[],
): { x: number, y: number } {
  const max = lhsCtx.length + rhsCtx.length + 1

  const kdown = lhsLower - rhsLower
  const kup = lhsUpper - rhsUpper
  const delta = (lhsUpper - lhsLower) - (rhsUpper - rhsLower)
  const odd = (delta & 1) != 0
  const offsetDown = max - kdown
  const offsetUp = max - kup
  const maxd = ((lhsUpper - lhsLower + rhsUpper - rhsLower) / 2) + 1
  const ret = { x: 0, y: 0 }
  let d: number
  let k: number
  let x: number
  let y: number

  vectorD[offsetDown + kdown + 1] = lhsLower
  vectorU[offsetUp + kup - 1] = lhsUpper
  for (d = 0; d <= maxd; ++d) {
    for (k = kdown - d; k <= kdown + d; k += 2) {
      if (k === kdown - d) {
        x = vectorD[offsetDown + k + 1]! // down
      } else {
        x = vectorD[offsetDown + k - 1]! + 1 // right
        if ((k < (kdown + d)) && (vectorD[offsetDown + k + 1]! >= x)) {
          x = vectorD[offsetDown + k + 1]! // down
        }
      }
      y = x - k
      // find the end of the furthest reaching forward D-path in diagonal k.
      while ((x < lhsUpper) &&
        (y < rhsUpper) &&
        (lhsCtx.codes[x] === rhsCtx.codes[y])
      ) {
        x++; y++
      }
      vectorD[offsetDown + k]! = x
      // overlap ?
      if (odd && (kup - d < k) && (k < kup + d)) {
        if (vectorU[offsetUp + k]! <= vectorD[offsetDown + k]!) {
          ret.x = vectorD[offsetDown + k]!
          ret.y = vectorD[offsetDown + k]! - k
          return (ret)
        }
      }
    }
    // Extend the reverse path.
    for (k = kup - d; k <= kup + d; k += 2) {
      // find the only or better starting point
      if (k === kup + d) {
        x = vectorU[offsetUp + k - 1]! // up
      } else {
        x = vectorU[offsetUp + k + 1]! - 1 // left
        if ((k > kup - d) && (vectorU[offsetUp + k - 1]! < x)) {
          x = vectorU[offsetUp + k - 1]!
        } // up
      }
      y = x - k
      while ((x > lhsLower) &&
        (y > rhsLower) &&
        (lhsCtx.codes[x - 1] === rhsCtx.codes[y - 1])
      ) {
        // diagonal
        x--
        y--
      }
      vectorU[offsetUp + k] = x
      // overlap ?
      if (!odd && (kdown - d <= k) && (k <= kdown + d)) {
        if (vectorU[offsetUp + k]! <= vectorD[offsetDown + k]!) {
          ret.x = vectorD[offsetDown + k]!
          ret.y = vectorD[offsetDown + k]! - k
          return (ret)
        }
      }
    }
  }

  // coverage ignore next // we should never get here
  fail('Unexpected state computing diff')
}

function getLongestCommonSubsequence(
    lhsCtx: Context, lhsLower: number, lhsUpper: number,
    rhsCtx: Context, rhsLower: number, rhsUpper: number,
    vectorU = [], vectorD = [],
): void {
  // trim off the matching items at the beginning
  while ( (lhsLower < lhsUpper) &&
    (rhsLower < rhsUpper) &&
    (lhsCtx.codes[lhsLower] === rhsCtx.codes[rhsLower]) ) {
    ++lhsLower
    ++rhsLower
  }
  // trim off the matching items at the end
  while ( (lhsLower < lhsUpper) &&
    (rhsLower < rhsUpper) &&
    (lhsCtx.codes[lhsUpper - 1] === rhsCtx.codes[rhsUpper - 1]) ) {
    --lhsUpper
    --rhsUpper
  }
  if (lhsLower === lhsUpper) {
    while (rhsLower < rhsUpper) {
      rhsCtx.modified[rhsLower++] = true
    }
  } else if (rhsLower === rhsUpper) {
    while (lhsLower < lhsUpper) {
      lhsCtx.modified[lhsLower++] = true
    }
  } else {
    const { x, y } = getShortestMiddleSnake(
        lhsCtx, lhsLower, lhsUpper,
        rhsCtx, rhsLower, rhsUpper,
        vectorU, vectorD)
    getLongestCommonSubsequence(
        lhsCtx, lhsLower, x,
        rhsCtx, rhsLower, y,
        vectorU, vectorD)
    getLongestCommonSubsequence(
        lhsCtx, x, lhsUpper,
        rhsCtx, y, rhsUpper,
        vectorU, vectorD)
  }
}

/* ========================================================================== *
 * INTERNAL CLASSES                                                           *
 * ========================================================================== */

/** The context to use while executing the diff */
class Context {
  /** Keep a tab on modified items */
  readonly modified: (true | undefined)[]
  /** A _code table_ for all the items in this context */
  readonly codes: readonly number[]
  /** The number of item held by this context */
  readonly length: number

  /** Construct with a _code table_ */
  constructor(codes: number[]) {
    const length = this.length = codes.length
    this.modified = new Array(length)
    this.codes = codes
  }
}

/** A codec producing _code tables_ */
class Coder<T, I extends Iterable<T> = Iterable<T>> {
  private _primitives = new Map<T, number>()
  private _objects: [ T, number ][] = []
  private _index = 1

  private _getObjectCode(item: T): number {
    for (const [ object, code ] of this._objects) {
      if (isDeepStrictEqual(item, object)) return code
    }

    const code = ++ this._index
    this._objects.push([ item, code ])
    return code
  }

  private _getPrimitiveCode(item: T): number {
    let code = this._primitives.get(item)
    if (code) return code

    code = ++ this._index
    this._primitives.set(item, code)
    return code
  }

  /** Get the code table for an {@link Iterable} */
  getCodes(iterable: I): number[] {
    const codes: number[] = []
    for (const item of iterable) {
      const type = item === null ? 'null' : typeof item

      const code = type === 'object' ?
        this._getObjectCode(item) :
        this._getPrimitiveCode(item)

      codes.push(code)
    }

    return codes
  }
}

/* ========================================================================== *
 * EXPORTED FUNCTIONS                                                         *
 * ========================================================================== */

/**
 * Compare the _Left-Hand side_ {@link Iterable} to _Right-Hand side_ one,
 * producing an array of {@link Change | Changes} identifying the differences.
 */
export function diff<T, I extends Iterable<T> = Iterable<T>>(
    lhs: I,
    rhs: I,
): Change[] {
  assert(lhs !== undefined, 'Left-Hand side undefined')
  assert(rhs !== undefined, 'Right-Hand side undefined')

  const codec = new Coder<T>()
  const lhsCtx = new Context(codec.getCodes(lhs))
  const rhsCtx = new Context(codec.getCodes(rhs))

  getLongestCommonSubsequence(
      lhsCtx, 0, lhsCtx.length,
      rhsCtx, 0, rhsCtx.length,
  )

  return compareLongestCommonSubsequence(lhsCtx, rhsCtx)
}

/** Produce a textual diff between two values using their JSON representation. */
export function textDiff(
    lhs: any,
    rhs: any,
    add?: (s: string) => string,
    del?: (s: string) => string,
    not?: (s: string) => string,
): string {
  // Defaults for our "add" "del" and "not" functions (depending on colorization)
  const _add = add || logOptions.colors ? $grn : (s: string): string => `+ ${s}`
  const _del = del || logOptions.colors ? $red : (s: string): string => `- ${s}`
  const _not = not || logOptions.colors ? (s: string): string => s : (s: string): string => `  ${s}`

  // Replacer for JSON.stringify sorting object keys
  function replacer(_key: string, value: any): any {
    // Only hashes (no "null", arrays or primitives)
    if (value && (typeof value === 'object') && (! Array.isArray(value))) {
      return Object.keys(value).sort().reduce((sorted, key) => {
        sorted[key] = value[key]
        return sorted
      }, {} as Record<string, any>)
    } else {
      return value
    }
  }

  // Convert both object to JSON with sorted keys and split by lines
  const ls = lhs === undefined ? [] : JSON.stringify(lhs, replacer, 2).split('\n')
  const rs = rhs === undefined ? [] : JSON.stringify(rhs, replacer, 2).split('\n')

  // Calculate the difference between the two arrays of strings
  const changes = diff(ls, rs)
  if (changes.length === 0) return ''

  // Go through changes and highlight
  let offset = 0
  const result: string[] = []
  changes.forEach(({ lhsPos, lhsDel, rhsPos, rhsAdd }) => {
    if (offset != lhsPos) result.push(_not(ls.slice(offset, lhsPos).join('\n')))
    if (lhsDel) result.push(_del(ls.slice(lhsPos, lhsPos + lhsDel).join('\n')))
    if (rhsAdd) result.push(_add(rs.slice(rhsPos, rhsPos + rhsAdd).join('\n')))
    offset = lhsPos + lhsDel
  })
  if (offset < ls.length) result.push(_not(ls.slice(offset).join('\n')))

  // Join our results and return
  return result.join('\n')
}
