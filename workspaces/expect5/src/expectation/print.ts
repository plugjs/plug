import { $grn, $gry, $red, $und, $wht, $ylw } from '@plugjs/plug/logging'
import { textDiff } from '@plugjs/plug/utils'

import { isMatcher, stringifyValue } from './types'

import type { Logger } from '@plugjs/plug/logging'
import type {
  Diff,
  ExpectedDiff,
  ExtraValueDiff,
  MissingValueDiff,
  ObjectDiff,
} from './diff'

/* ========================================================================== *
 * CONSTANT LABELS FOR PRINTING                                               *
 * ========================================================================== */

const _opnPar = $gry('(')
const _clsPar = $gry(')')

const _opnCrl = $gry('{')
const _clsCrl = $gry('}')
const _curls = $gry('{}')

const _opnSqr = $gry('[')
const _clsSqr = $gry(']')
const _squares = $gry('[]')

const _slash = $gry('/')
const _tilde = $gry('~')
const _hellip = $gry('\u2026')

const _error = `${_opnPar}${$gry($und('error'))}${_clsPar}`
const _string = `${_opnPar}${$gry($und('string'))}${_clsPar}`
const _matcher = $gry('\u2026 matcher \u2026')
const _extraProps = $gry('\u2026 extra props \u2026')
const _diffHeader = `${$wht('Differences')} ${_opnPar}${$red('actual')}${_slash}${$grn('expected')}${_slash}${$ylw('errors')}${_clsPar}:`

/* ========================================================================== *
 * PRINT DEPENDING ON DIFF TYPE                                               *
 * ========================================================================== */

function printBaseDiff(
    log: Logger,
    diff: Diff,
    prop: string,
    mapping: boolean,
    comma: boolean,
): void {
  if ('props' in diff) return printObjectDiff(log, diff, prop, mapping, comma)
  if ('values' in diff) return printObjectDiff(log, diff, prop, mapping, comma)
  if ('mappings' in diff) return printObjectDiff(log, diff, prop, mapping, comma)
  if ('expected' in diff) return printExpectedDiff(log, diff, prop, mapping, comma)
  if ('missing' in diff) return printMissingDiff(log, diff, prop, mapping, comma)
  if ('extra' in diff) return printExtraDiff(log, diff, prop, mapping, comma)

  const { prefix, suffix } =
      diff.error ? // default style if error is the only property
          fixups(prop, mapping, comma, diff.error) :
      diff.diff ? // label as "differs" if no error was found
          fixups(prop, mapping, comma, diff.error, $red, 'differs') :
      fixups(prop, mapping, comma, diff.error)

  dump(log, diff.value, prefix, suffix, diff.diff ? $red : $wht)
}

/* ========================================================================== */

function printExpectedDiff(
    log: Logger,
    diff: ExpectedDiff,
    prop: string,
    mapping: boolean,
    comma: boolean,
): void {
  // two different strings get a special treatment: a proper "diff"
  if ((typeof diff.value === 'string') && (typeof diff.expected === 'string')) {
    const { prefix, suffix } = fixups(prop, mapping, false, diff.error)

    log.warn(`${prefix}${_string}${suffix}`)
    textDiff(diff.value, diff.expected).split('\n').forEach((line) => {
      log.warn(`  ${_hellip} ${line}`)
    })

  // if "value" is not an object (can fit on one line) we use it as prefix
  } else if ((diff.value === null) || (typeof diff.value !== 'object')) {
    const { prefix, suffix } = fixups(prop, mapping, comma, diff.error)

    const joined = `${prefix}${$red(stringify(diff.value))} ${_tilde} `
    dump(log, diff.expected, joined, suffix, $grn)

  // if "expected" is not an object (can fit on one line) we use it as suffix
  } else if ((diff.expected === null) || (typeof diff.expected !== 'object')) {
    const { prefix, suffix } = fixups(prop, mapping, comma, diff.error)

    const joined = ` ${_tilde} ${$grn(stringify(diff.expected))}${suffix}`
    dump(log, diff.value, prefix, joined, $red)

  // both "value" and "expected" are objects, so, we join them with a ~
  } else {
    // here the error _only_ goes on the last line...
    const { prefix, suffix: suffix1 } = fixups(prop, mapping, false, '')
    const { suffix: suffix2 } = fixups(prop, mapping, comma, diff.error)

    const lastLine = dumpAndContinue(log, diff.expected, prefix, suffix1, $red)
    dump(log, diff.value, `${lastLine} ${_tilde} `, suffix2, $grn)
  }
}

/* ========================================================================== */

function printMissingDiff(
    log: Logger,
    diff: MissingValueDiff,
    prop: string,
    mapping: boolean,
    comma: boolean,
): void {
  const { prefix, suffix } = fixups(prop, mapping, comma, diff.error, $red, 'missing')
  dump(log, diff.missing, prefix, suffix, $red)
}

/* ========================================================================== */

function printExtraDiff(
    log: Logger,
    diff: ExtraValueDiff,
    prop: string,
    mapping: boolean,
    comma: boolean,
): void {
  const { prefix, suffix } = fixups(prop, mapping, comma, diff.error, $red, 'extra')
  dump(log, diff.extra, prefix, suffix, $red)
}

/* ========================================================================== */

function printObjectDiff(
    log: Logger,
    diff: ObjectDiff,
    prop: string,
    mapping: boolean,
    comma: boolean,
): void {
  const { prefix, suffix } = fixups(prop, mapping, comma, diff.error)

  // prepare for deep inspection
  const value = diff.value
  const ctor = Object.getPrototypeOf(value)?.constructor
  const string = (ctor === Object) || (ctor === Array) ? '' : stringifyValue(value)

  // prepare first line of output
  let line = string ? `${prefix}${$wht(string)} ` : prefix
  let marked = false

  // arrays or sets
  if (diff.values) {
    if (diff.values.length === 0) {
      line = `${line}${_squares}`
    } else {
      log.warn(`${line}${_opnSqr}`)
      log.enter()
      try {
        for (const subdiff of diff.values) {
          printBaseDiff(log, subdiff, '', false, true)
        }
      } finally {
        log.leave()
      }
      line = _clsSqr
    }
    marked = true

  // values and mappings (arrays/sets and maps) are mutually exclusive
  } else if (diff.mappings) {
    if (Object.keys(diff.mappings).length === 0) {
      line = `${line}${_curls}`
    } else {
      log.warn(`${line}${_opnCrl}`)
      log.enter()
      try {
        for (const [ key, subdiff ] of diff.mappings) {
          printBaseDiff(log, subdiff, stringifyValue(key), true, true)
        }
      } finally {
        log.leave()
      }
      line = _clsCrl
    }
    marked = true
  }

  // extra properties
  if (diff.props) {
    if (marked) line = `${line} ${_extraProps} `
    if (Object.keys(diff.props).length === 0) {
      line = `${line}${_curls}`
    } else {
      log.warn(`${line}${_opnCrl}`)
      log.enter()
      try {
        for (const [ prop, subdiff ] of Object.entries(diff.props)) {
          printBaseDiff(log, subdiff, stringifyValue(prop), false, true)
        }
      } finally {
        log.leave()
      }
      line = _clsCrl
    }
    marked = true
  }

  log.warn(`${line}${suffix}`)
}

/* ========================================================================== *
 * PRINT HELPERS                                                              *
 * ========================================================================== */

function stringify(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    value: null | undefined | string | number | boolean | bigint | symbol | Function,
): string {
  if (typeof value === 'string') return JSON.stringify(value)
  return stringifyValue(value)
}

function fixups(
    prop: string,
    mapping: boolean,
    comma: boolean,
    error: string | undefined,
    color?: ((string: string) => string) | undefined,
    label?: string,
): { prefix: string, suffix: string } {
  if (error) color = color || $ylw

  const lbl = label ? `${_opnPar}${$gry($und(label))}${_clsPar} ` : ''
  const sep = mapping ? ' => ': ': '
  const prefix = prop ?
      color ?
          `${$gry(lbl)}${color(prop)}${$gry(sep)}` :
          `${$gry(lbl)}${prop}${$gry(sep)}` :
      label ?
          `${$gry(lbl)}` :
          ''
  error = error ? ` ${_error} ${$ylw(error)}` : ''
  const suffix = `${comma ? $gry(',') : ''}${error}`
  return { prefix, suffix }
}

function dump(
    log: Logger,
    value: any,
    prefix: string,
    suffix: string,
    color: (string: string) => string,
    stack: any[] = [],
): void {
  log.warn(dumpAndContinue(log, value, prefix, suffix, color, stack))
}

function dumpAndContinue(
    log: Logger,
    value: any,
    prefix: string,
    suffix: string,
    color: (string: string) => string,
    stack: any[] = [],
): string {
  // primitives just get dumped
  if ((value === null) || (typeof value !== 'object')) {
    return `${prefix}${color(stringify(value))}${suffix}`
  }

  // matchers are a very special value...
  if (isMatcher(value)) {
    return `${prefix}${_matcher}${suffix}`
  }

  // check for circular dependencies
  const circular = stack.indexOf(value)
  if (circular >= 0) {
    return `${prefix}${$gry($und(`<circular ${circular}>`))}${suffix}`
  }

  // prepare for deep inspection
  const ctor = Object.getPrototypeOf(value)?.constructor
  const string = (ctor === Object) || (ctor === Array) ? '' : stringifyValue(value)
  const keys = new Set(Object.keys(value))

  // prepare first line of output
  let line = string ? `${prefix}${color(string)} ` : prefix
  let marked = false

  // arrays (will remove keys for properties)
  if (Array.isArray(value)) {
    if (value.length === 0) {
      line = `${line}${_squares}`
    } else {
      log.warn(`${line}${_opnSqr}`)
      log.enter()
      try {
        for (let i = 0; i < value.length; i ++) {
          const { prefix, suffix } = fixups('', false, true, undefined, color)
          dump(log, value[i], prefix, suffix, color, [ ...stack, value ])
          keys.delete(String(i))
        }
      } finally {
        log.leave()
      }
      line = _clsSqr
    }
    marked = true

    // arrays, sets and maps are mutually exclusive...
  } else if (value instanceof Set) {
    if (value.size === 0) {
      line = `${line}${_squares}`
    } else {
      log.warn(`${line}${_opnSqr}`)
      log.enter()
      try {
        const { prefix, suffix } = fixups('', false, true, undefined, color)
        value.forEach((v) => dump(log, v, prefix, suffix, color, [ ...stack, value ]))
      } finally {
        log.leave()
      }
      line = _clsSqr
    }
    marked = true

    // arrays, sets and maps are mutually exclusive...
  } else if (value instanceof Map) {
    if (value.size === 0) {
      line = `${line}${_curls}`
    } else {
      log.warn(`${line}${_opnCrl}`)
      log.enter()
      try {
        for (const [ key, subvalue ] of value) {
          const { prefix, suffix } = fixups(stringifyValue(key), true, true, undefined, color)
          dump(log, subvalue, prefix, suffix, color, [ ...stack, value ])
        }
      } finally {
        log.leave()
      }
      line = _clsCrl
    }
    marked = true
  }

  // boxed strings leave props around
  if (value instanceof String) {
    const length = value.valueOf().length
    for (let i = 0; i < length; i ++) keys.delete(String(i))
  }

  // extra properties might appear at any time...
  if (keys.size) {
    if (marked) line = `${line} ${_extraProps} `
    log.warn(`${line}${_opnCrl}`)
    log.enter()
    try {
      for (const key of keys) {
        const { prefix, suffix } = fixups(stringifyValue(key), false, true, undefined, color)
        dump(log, value[key], prefix, suffix, color, [ ...stack, value ])
      }
    } finally {
      log.leave()
    }
    line = _clsCrl
    marked = true
  }

  if (marked) {
    return `${line}${suffix}`
  } else {
    return `${line}${_curls}${suffix}`
  }
}

/* ========================================================================== *
 * EXPORTSD                                                                   *
 * ========================================================================== */

/** Print a {@link Diff} to a log, with a nice header by default... */
export function printDiff(log: Logger, diff: Diff, header = true): void {
  if (! header) return printBaseDiff(log, diff, '', false, false)

  log.warn(_diffHeader)
  log.enter()
  try {
    printBaseDiff(log, diff, '', false, false)
  } finally {
    log.leave()
  }
}
