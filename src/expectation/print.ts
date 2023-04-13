import { inspect } from 'node:util'

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
  dump(log, diff.value, prop, mapping, comma, $wht)
}

function printValueDiff(log: Logger, diff: ValueDiff, prop: string, mapping: boolean, comma: boolean): void {
  const [ aFirst, aRest ] = toString(diff.actual)
  const [ eFirst, eRest ] = toString(diff.expected)

  const { prefix, filler, suffix } = fixups(prop, mapping, comma)

  if (aRest || eRest) {
    log.warn(`${prefix}${$red(aFirst)}${aRest ? '' : suffix}`)
    if (aRest) log.warn(`${$red(aRest)}${suffix}`)

    log.warn(`${filler}${$grn(eFirst)}${eRest ? '' : suffix}`)
    if (eRest) log.warn(`${$grn(eRest)}${suffix}`)
  } else {
    log.warn(`${prefix}${$red(aFirst)} ${$gry('/')} ${$grn(eFirst)}${suffix}`)
  }
}

function printErrorDiff(log: Logger, diff: ErrorDiff, prop: string, mapping: boolean, comma: boolean): void {
  const [ first, rest ] = toString(diff.value)

  const { prefix, suffix } = fixups(prop, mapping, comma)
  const error = ` ${$gry('/')} ${$ylw(diff.error)} ${$gry('(')}${$gry($und('error'))}${$gry(')')}${suffix}`

  log.warn(`${prefix}${$red(first)}${rest ? '' : error}`)
  if (rest) log.warn(`${$red(rest)}${error}`)
}

function printMissingDiff(log: Logger, diff: MissingValueDiff, prop: string, mapping: boolean, comma: boolean): void {
  const [ first, rest ] = toString(diff.missing)

  const { prefix, suffix } = fixups(prop, mapping, comma)
  const missing = ` ${$gry('(')}${$gry($und('missing'))}${$gry(')')}${suffix}`

  log.warn(`${prefix}${$grn(first)}${rest ? '' : missing}`)
  if (rest) log.warn(`${$red(rest)}${missing}`)
}

function printExtraDiff(log: Logger, diff: ExtraValueDiff, prop: string, mapping: boolean, comma: boolean): void {
  const [ first, rest ] = toString(diff.extra)

  const { prefix, suffix } = fixups(prop, mapping, comma)
  const extra = ` ${$gry('(')}${$gry($und('extra'))}${$gry(')')}${suffix}`

  log.warn(`${prefix}${$red(first)}${rest ? '' : extra}`)
  if (rest) log.warn(`${$red(rest)}${extra}`)
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
    if (marked) line = `${line} ${$gry('\u2026 mappings \u2026')} `
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
): { prefix: string, filler: string, suffix: string } {
  const sep = mapping ? ' => ': ': '
  const prefix = prop ? `${prop}${$gry(sep)}` : ''
  const filler = prop ? ''.padStart(prop.length + sep.length) : ''
  const suffix = comma ? $gry(',') : ''
  return { prefix, filler, suffix }
}

function dump(
    log: Logger,
    value: any,
    prop: string,
    mapping: boolean,
    comma: boolean,
    color: (string: string) => string,
    stack: any[] = [],
): void {
  const { prefix, suffix } = fixups(prop, mapping, comma)

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
          dump(log, value[i], '', false, true, color, [ ...stack, value ])
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
        value.forEach((v) => dump(log, v, '', false, true, color, [ ...stack, value ]))
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
          dump(log, subvalue, stringifyValue(key), true, true, color, [ ...stack, value ])
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
        dump(log, value[key], key, false, true, color, [ ...stack, value ])
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

function toString(value: any): [ string, string? ] {
  const inspected = stringifyValue(value, (value) => {
    if (value instanceof Promise) return '[Promise]'
    return inspect(value)
  })

  const [ first = '', ...lines ] = inspected.split('\n')
  const rest = lines.join('\n')
  return [ first, rest ? rest : undefined ]
}
