import { $grn, $gry, $red, $und, $wht, $ylw, type Logger } from '@plugjs/plug/logging'

import { stringifyPrimitive, stringifyValue } from './types'

import type { Diff, ExtraValueDiff, MissingValueDiff, BaseDiff, ObjectDiff, ValueDiff } from './diff'

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

const _extraProps = $gry('\u2026 extra props \u2026')
const _diffHeader = `${$wht('Differences')} ${_opnPar}${$red('actual')}${_slash}${$grn('expected')}${_slash}${$ylw('errors')}${_clsPar}:`

/* ========================================================================== *
 * PRINT DEPENDING ON DIFF TYPE                                               *
 * ========================================================================== */

function print(log: Logger, diff: Diff, prefix: string, mapping: boolean, comma: boolean): void {
  if ('props' in diff) return printObjectDiff(log, diff, prefix, mapping, comma)
  if ('values' in diff) return printObjectDiff(log, diff, prefix, mapping, comma)
  if ('mappings' in diff) return printObjectDiff(log, diff, prefix, mapping, comma)
  if ('expected' in diff) return printValueDiff(log, diff, prefix, mapping, comma)
  if ('missing' in diff) return printMissingDiff(log, diff, prefix, mapping, comma)
  if ('extra' in diff) return printExtraDiff(log, diff, prefix, mapping, comma)
  return printBaseDiff(log, diff, prefix, mapping, comma)
}

function printBaseDiff(log: Logger, diff: BaseDiff, prop: string, mapping: boolean, comma: boolean): void {
  const { prefix, suffix } =
      diff.error ? // default style if error is the only property
          fixups(prop, mapping, comma, diff.error) :
      diff.diff ? // label as "differs" if no error was found
          fixups(prop, mapping, comma, diff.error, $red, 'differs') :
      fixups(prop, mapping, comma, diff.error)

  dump(log, diff.value, prefix, suffix, diff.diff ? $red : $wht)
}

function printValueDiff(log: Logger, diff: ValueDiff, prop: string, mapping: boolean, comma: boolean): void {
  const { prefix, suffix } = fixups(prop, mapping, comma, diff.error)

  if ((diff.value === null) || (typeof diff.value !== 'object')) {
    const joined = `${prefix} ${$red(stringifyPrimitive(diff.value))} ${_tilde} `
    dump(log, diff.expected, joined, suffix, $grn)
  } else if ((diff.expected === null) || (typeof diff.expected !== 'object')) {
    const joined = ` ${_tilde} ${$grn(stringifyPrimitive(diff.expected))}${suffix}`
    dump(log, diff.value, prefix, joined, $red)
  } else {
    const lastLine = dumpToLine(log, diff.expected, prefix, suffix, $red)
    dump(log, diff.expected, `${lastLine} ${_tilde} `, suffix, $grn)
  }
}

// function printErrorDiff(log: Logger, diff: ErrorDiff, prop: string, mapping: boolean, comma: boolean): void {
//   const { prefix, suffix } = fixups(prop, mapping, comma, $ylw, 'error')
//   const error = `${suffix} ${$ylw(diff.error)}`
//   dump(log, diff.value, prefix, error, $red)
// }

function printMissingDiff(log: Logger, diff: MissingValueDiff, prop: string, mapping: boolean, comma: boolean): void {
  const { prefix, suffix } = fixups(prop, mapping, comma, diff.error, $red, 'missing')
  dump(log, diff.missing, prefix, suffix, $red)
}

function printExtraDiff(log: Logger, diff: ExtraValueDiff, prop: string, mapping: boolean, comma: boolean): void {
  const { prefix, suffix } = fixups(prop, mapping, comma, diff.error, $red, 'extra')
  dump(log, diff.extra, prefix, suffix, $red)
}

function printObjectDiff(log: Logger, diff: ObjectDiff, prop: string, mapping: boolean, comma: boolean): void {
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
    log.warn(`${line}${_opnSqr}`)
    try {
      log.enter()
      for (const subdiff of diff.values) {
        print(log, subdiff, '', false, true)
      }
    } finally {
      log.leave()
    }
    line = _clsSqr
    marked = true

  // values and mappings (arrays/sets/maps) are mutually exclusive
  } else if (diff.mappings) {
    log.warn(`${line}${_opnCrl}`)
    try {
      log.enter()
      for (const [ key, subdiff ] of diff.mappings) {
        print(log, subdiff, stringifyValue(key), true, true)
      }
    } finally {
      log.leave()
    }
    line = _clsCrl
    marked = true
  }

  // extra properties
  if (diff.props) {
    if (marked) line = `${line} ${_extraProps} `
    log.warn(`${line}${_opnCrl}`)
    try {
      log.enter()
      for (const [ prop, subdiff ] of Object.entries(diff.props)) {
        print(log, subdiff, prop, false, true)
      }
    } finally {
      log.leave()
    }
    line = _clsCrl
    marked = true
  }

  log.warn(`${line}${suffix}`)
}

/* ========================================================================== *
 * PRINT HELPERS                                                              *
 * ========================================================================== */

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
  error = error ? ` ${_opnPar}${$gry($und('error'))}${_clsPar} ${$ylw(error)}` : ''
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
  const lastLine = dumpToLine(log, value, prefix, suffix, color, stack)
  log.warn(lastLine)
}

function dumpToLine(
    log: Logger,
    value: any,
    prefix: string,
    suffix: string,
    color: (string: string) => string,
    stack: any[] = [],
): string {
// primitives just get dumped
  if ((value === null) || (typeof value !== 'object')) {
    const string = stringifyPrimitive(value)
    return `${prefix}${color(string)}${suffix}`
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
  let line = string ? `${prefix}${$wht(string)} ` : prefix
  let marked = false

  // arrays (will remove keys for properties)
  if (Array.isArray(value)) {
    if (value.length === 0) {
      line = `${line}${_squares}`
    } else {
      log.warn(`${line}${_opnSqr}`)
      try {
        log.enter()
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
      try {
        log.enter()
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
      try {
        log.enter()
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
    try {
      log.enter()
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
  if (header) log.warn(_diffHeader)
  print(log, diff, '', false, false)
}
