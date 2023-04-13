import { $grn, $gry, $red, $und, $wht, $ylw, type Logger } from '@plugjs/plug/logging'

import { stringifyPrimitive, stringifyValue } from './types'

import type { Diff, ErrorDiff, ExtraValueDiff, MissingValueDiff, NoDiff, ObjectDiff, ValueDiff } from './diff'

export function printDiff(log: Logger, diff: Diff, header = true): void {
  if (header) {
    log.warn(`${$wht('Differences')} ${$gry('(')}${$red('actual')}${$gry('/')}${$grn('expected')}${$gry('/')}${$ylw('errors')}${$gry(')')}:`)
  }
  print(log, diff, '', false, false)
}

/* ========================================================================== *
 * PRINT DEPENDING ON DIFF TYPE                                               *
 * ========================================================================== */

function print(log: Logger, diff: Diff, prefix: string, mapping: boolean, comma: boolean): void {
  if ('type' in diff) return printObjectDiff(log, diff, prefix, mapping, comma) // TODO: remove me!
  if ('error' in diff) return printErrorDiff(log, diff, prefix, mapping, comma)
  if ('expected' in diff) return printValueDiff(log, diff, prefix, mapping, comma)
  if ('missing' in diff) return printMissingDiff(log, diff, prefix, mapping, comma)
  if ('extra' in diff) return printExtraDiff(log, diff, prefix, mapping, comma)
  return printNoDiff(log, diff, prefix, mapping, comma)
}

function printNoDiff(log: Logger, diff: NoDiff, prop: string, mapping: boolean, comma: boolean): void {
  const { prefix, suffix } = fixups(prop, mapping, comma)
  dump(log, diff.value, prefix, suffix, $wht)
}

function printValueDiff(log: Logger, diff: ValueDiff, prop: string, mapping: boolean, comma: boolean): void {
  const { prefix, filler, suffix } = fixups(prop, mapping, comma)

  if ((diff.actual === null) || (typeof diff.actual !== 'object')) {
    const joined = `${prefix} ${$red(stringifyPrimitive(diff.actual))} ${$gry('~')} `
    dump(log, diff.expected, joined, suffix, $grn)
  } else if ((diff.expected === null) || (typeof diff.expected !== 'object')) {
    const joined = ` ${$gry('~')} ${$grn(stringifyPrimitive(diff.expected))}${suffix}`
    dump(log, diff.actual, prefix, joined, $red)
  } else {
    dump(log, diff.expected, prefix, `${suffix} ${$gry('~')}`, $red)
    dump(log, diff.expected, `${$gry('~')} ${filler}`, suffix, $grn)
  }
}

function printErrorDiff(log: Logger, diff: ErrorDiff, prop: string, mapping: boolean, comma: boolean): void {
  const { prefix, suffix } = fixups(prop, mapping, comma, $ylw, 'error')
  const error = `${suffix} ${$ylw(diff.error)}`
  dump(log, diff.value, prefix, error, $red)
}

function printMissingDiff(log: Logger, diff: MissingValueDiff, prop: string, mapping: boolean, comma: boolean): void {
  const { prefix, suffix } = fixups(prop, mapping, comma, $red, 'missing')
  dump(log, diff.missing, prefix, suffix, $red)
}

function printExtraDiff(log: Logger, diff: ExtraValueDiff, prop: string, mapping: boolean, comma: boolean): void {
  const { prefix, suffix } = fixups(prop, mapping, comma, $red, 'extra')
  dump(log, diff.extra, prefix, suffix, $red)
}

function printObjectDiff(log: Logger, diff: ObjectDiff, prop: string, mapping: boolean, comma: boolean): void {
  const { prefix, suffix } = fixups(prop, mapping, comma)

  let line = `${prefix}${$wht(diff.type)}`
  let marked = false

  // arrays or sets
  if (diff.values) {
    log.warn(`${line}${$gry('[')}`)
    try {
      log.enter()
      for (const subdiff of diff.values) {
        print(log, subdiff, '', false, true)
      }
    } finally {
      log.leave()
    }
    line = $gry('] ')
    marked = true

  // values and mappings (arrays/sets/maps) are mutually exclusive
  } else if (diff.mappings) {
    log.warn(`${line}${$gry('{')}`)
    try {
      log.enter()
      for (const [ key, subdiff ] of diff.mappings) {
        print(log, subdiff, stringifyValue(key), true, true)
      }
    } finally {
      log.leave()
    }
    line = $gry('} ')
    marked = true
  }

  // extra properties
  if (diff.props) {
    if (marked) line = `${line} ${$gry('\u2026 extra props \u2026')} `
    log.warn(`${line}${$gry('{')}`)
    try {
      log.enter()
      for (const [ prop, subdiff ] of Object.entries(diff.props)) {
        print(log, subdiff, prop, false, true)
      }
    } finally {
      log.leave()
    }
    line = $gry('} ')
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
    color?: (string: string) => string,
    label: string = '',
): { prefix: string, filler: string, suffix: string } {
  const lbl = label ? `${$gry('(')}${$gry($und(label))}${$gry(')')} ` : ''
  const sep = mapping ? ' => ': ': '
  const prefix = prop ?
      color ?
          `${$gry(lbl)}${color(prop)}${$gry(sep)}` :
          `${$gry(lbl)}${prop}${$gry(sep)}` :
      label ?
          `${$gry(lbl)}` :
          ''
  const filler = prop ?
      label ?
        ''.padStart(prop.length + sep.length + label.length + 3) :
        ''.padStart(prop.length + sep.length) :
        ''

  const suffix = comma ? $gry(',') : ''
  return { prefix, filler, suffix }
}

function dump(
    log: Logger,
    value: any,
    prefix: string,
    suffix: string,
    color: (string: string) => string,
    stack: any[] = [],
): void {
  // primitives just get dumped
  if ((value === null) || (typeof value !== 'object')) {
    const string = stringifyPrimitive(value)
    return log.warn(`${prefix}${color(string)}${suffix}`)
  }

  // check for circular dependencies
  const circular = stack.indexOf(value)
  if (circular >= 0) {
    return log.warn(`${prefix}${$gry($und(`<circular ${circular}>`))}${suffix}`)
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
      line = `${line}${$gry('[]')}`
    } else {
      log.warn(`${line}${$gry('[')}`)
      try {
        log.enter()
        for (let i = 0; i < value.length; i ++) {
          const { prefix, suffix } = fixups('', false, true, color)
          dump(log, value[i], prefix, suffix, color, [ ...stack, value ])
          keys.delete(String(i))
        }
      } finally {
        log.leave()
      }
      line = $gry(']')
    }
    marked = true

  // arrays, sets and maps are mutually exclusive...
  } else if (value instanceof Set) {
    if (value.size === 0) {
      line = `${line}${$gry('[]')}`
    } else {
      log.warn(`${line}${$gry('[')}`)
      try {
        log.enter()
        const { prefix, suffix } = fixups('', false, true, color)
        value.forEach((v) => dump(log, v, prefix, suffix, color, [ ...stack, value ]))
      } finally {
        log.leave()
      }
      line = $gry(']')
    }
    marked = true

  // arrays, sets and maps are mutually exclusive...
  } else if (value instanceof Map) {
    if (value.size === 0) {
      line = `${line}${$gry('{}')}`
    } else {
      log.warn(`${line}${$gry('{')}`)
      try {
        log.enter()
        for (const [ key, subvalue ] of value) {
          const { prefix, suffix } = fixups(stringifyValue(key), true, true, color)
          dump(log, subvalue, prefix, suffix, color, [ ...stack, value ])
        }
      } finally {
        log.leave()
      }
      line = $gry('}')
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
    if (marked) line = `${line}${$gry(' \u2026 extra props \u2026 ')}`
    log.warn(`${line}${$gry('{')}`)
    try {
      log.enter()
      for (const key of keys) {
        const { prefix, suffix } = fixups(stringifyValue(key), false, true, color)
        dump(log, value[key], prefix, suffix, color, [ ...stack, value ])
      }
    } finally {
      log.leave()
    }
    line = $gry('}')
    marked = true
  }

  if (marked) {
    log.warn(`${line}${suffix}`)
  } else {
    log.warn(`${line}${$gry('{}')}${suffix}`)
  }
}
