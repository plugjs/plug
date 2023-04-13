import { inspect } from 'node:util'

import { $grn, $gry, $red, $und, $wht, $ylw, type Logger } from '@plugjs/plug/logging'

import { stringifyValue } from './expectation/types'

import type { Diff, ErrorDiff, ExtraValueDiff, MissingValueDiff, NoDiff, ObjectDiff, ValueDiff } from './expectation/diff'

export function printDiff(log: Logger, diff: Diff): void {
  log.notice('')
  log.notice('=== DIFF STARTS ===')
  // log.notice(diff)
  // log.notice('~~~ DIFF STARTS ~~~')
  log.enter()
  log.error(`${$wht('Differences')} ${$gry('(')}${$red('actual')}${$gry('/')}${$grn('expected')}${$gry('/')}${$ylw('errors')}${$gry(')')}:`)
  print(log, diff, '', false)
  log.leave()
  log.notice('=== DIFF ENDS ===')
  log.notice('')
}

function print(log: Logger, diff: Diff, prefix: string, comma: boolean): void {
  if ('type' in diff) return printObjectDiff(log, diff, prefix, comma)
  if ('error' in diff) return printErrorDiff(log, diff, prefix, comma)
  if ('expected' in diff) return printValueDiff(log, diff, prefix, comma)
  if ('missing' in diff) return printMissingDiff(log, diff, prefix, comma)
  if ('extra' in diff) return printExtraDiff(log, diff, prefix, comma)
  return printNoDiff(log, diff, prefix, comma)
}

function printNoDiff(log: Logger, diff: NoDiff, pfx: string, comma: boolean): void {
  const [ first, rest ] = toString(diff.value)

  const prefix = pfx ? $gry(pfx) : ''
  const suffix = comma ? $gry(',') : ''

  log.error(`${prefix}${first}${rest ? '' : suffix}`)
  if (rest) log.error(`${rest}${suffix}`)
}

function printValueDiff(log: Logger, diff: ValueDiff, pfx: string, comma: boolean): void {
  const [ aFirst, aRest ] = toString(diff.actual)
  const [ eFirst, eRest ] = toString(diff.expected)

  const prefix1 = pfx ? $gry(pfx) : ''
  const prefix2 = pfx ? ''.padStart(pfx.length) : ''
  const suffix = comma ? $gry(',') : ''

  if (aRest || eRest) {
    log.error(`${prefix1}${$red(aFirst)}${aRest ? '' : suffix}`)
    if (aRest) log.error(`${$red(aRest)}${suffix}`)

    log.error(`${prefix2}${$grn(eFirst)}${eRest ? '' : suffix}`)
    if (eRest) log.error(`${$grn(eRest)}${suffix}`)
  } else {
    log.error(`${prefix1}${$red(aFirst)} ${$gry('/')} ${$grn(eFirst)}${suffix}`)
  }
}

function printErrorDiff(log: Logger, diff: ErrorDiff, pfx: string, comma: boolean): void {
  const [ first, rest ] = toString(diff.value)
  log.error('TO STRING RETURNED', first, rest)

  const prefix1 = pfx ? $gry(pfx) : ''
  const prefix2 = pfx ? ''.padStart(pfx.length) : ''
  const suffix = comma ? $gry(',') : ''

  log.error(`${prefix1}${$red(first)}${rest ? '' : suffix}`)
  if (rest) log.error(`${$red(rest)}${suffix}`)

  log.error(`${prefix2}${$gry('Error:')} ${$ylw(diff.error)}${suffix}`)
}

function printMissingDiff(log: Logger, diff: MissingValueDiff, pfx: string, comma: boolean): void {
  const [ first, rest ] = toString(diff.missing)

  const prefix = pfx ? $gry(pfx) : ''
  const suffix = comma ? $gry(' (missing),') : $gry(' (missing)')

  log.error(`${prefix}${$grn(first)}${rest ? '' : suffix}`)
  if (rest) log.error(`${$red(rest)}${suffix}`)
}

function printExtraDiff(log: Logger, diff: ExtraValueDiff, pfx: string, comma: boolean): void {
  const [ first, rest ] = toString(diff.extra)

  const prefix = pfx ? $gry(pfx) : ''
  const suffix = comma ? $gry(' (extra),') : $gry(' (extra)')

  log.error(`${prefix}${$red(first)}${rest ? '' : suffix}`)
  if (rest) log.error(`${$red(rest)}${suffix}`)
}

function printObjectDiff(log: Logger, diff: ObjectDiff, pfx: string, comma: boolean): void {
  const prefix = pfx ? $gry(pfx) : ''
  const suffix = comma ? $gry(',') : ''

  let line = `${prefix}${$gry($und(diff.type))}`
  let marked = false

  if (diff.props) {
    log.error(`${line} ${$gry('{')}`)
    log.enter()
    for (const [ prop, subdiff ] of Object.entries(diff.props)) {
      print(log, subdiff, `${prop}: `, true)
    }
    log.leave()
    line = $gry('}')
    marked = true
  }

  if (diff.values) {
    if (marked) line = `${line} ${$gry('\u2026values\u2026')}`
    log.error(`${line} ${$gry('[')}`)
    log.enter()
    for (const subdiff of diff.values) {
      print(log, subdiff, '', true)
    }
    log.leave()
    line = $gry(']')
    marked = true
  }

  if (diff.mappings) {
    if (marked) line = `${line} ${$gry('\u2026mappings\u2026')}`
    log.error(`${line} ${$gry('{')}`)
    log.enter()
    for (const [ key, subdiff ] of diff.mappings) {
      print(log, subdiff, `${stringifyValue(key)} => `, true)
    }
    log.leave()
    line = $gry('}')
    marked = true
  }

  if (marked) {
    log.error(`${line}${suffix}`)
  } else {
    log.error(`${line} ${$gry('{}')}${suffix}`)
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
