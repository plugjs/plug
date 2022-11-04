import { formatWithOptions } from 'node:util'

import { $blu, $grn, $gry, $red, $t, $ylw } from './colors'
import { DEBUG, INFO, NOTICE, TRACE, WARN } from './levels'
import { logOptions } from './options'
import { zapSpinner } from './spinner'

import type { LogLevel } from './levels'

/* ========================================================================== */

/* Initial values, and subscribe to changes */
let _output = logOptions.output
let _indentSize = logOptions.indentSize
let _taskLength = logOptions.taskLength
let _lineLength = logOptions.lineLength
let _inspectOptions = logOptions.inspectOptions
logOptions.on('changed', (options) => {
  _output = options.output
  _indentSize = options.indentSize
  _taskLength = options.taskLength
  _lineLength = options.lineLength
  _inspectOptions = options.inspectOptions
})

/* ========================================================================== *
 * EMIT TEXT FOR LOGS / REPORTS                                               *
 * ========================================================================== */

/** Options for the {@link LogEmitter} function family */
export interface LogEmitterOptions {
  taskName: string,
  level: LogLevel,
  indent?: number,
  prefix?: string,
}

/** Emit a line (or multiple lines) of text to the log */
export type LogEmitter = (options: LogEmitterOptions, args: any[]) => void

/* ========================================================================== */

/** Emit in full colors! */
export const emitColor: LogEmitter = (options: LogEmitterOptions, args: any[]): void => {
  const { taskName, level, prefix, indent } = options
  const logPrefix = prefix ? prefix : indent ? ''.padStart(indent * _indentSize) : ''

  /* Prefixes, to prepend at the beginning of each line */
  const prefixes: string[] = []

  /* Task name or blank padding */
  prefixes.push(''.padStart(_taskLength - taskName.length, ' ')) // padding
  prefixes.push(`${$t(taskName)}`) // task name

  /* Level indicator (our little colorful squares) */
  if (level <= TRACE) {
    prefixes.push(` ${$gry('\u25a1')} `) // trace: gray open
  } else if (level <= DEBUG) {
    prefixes.push(` ${$gry('\u25a0')} `) // debug: gray
  } else if (level <= INFO) {
    prefixes.push(` ${$grn('\u25a0')} `) // info: green
  } else if (level <= NOTICE) {
    prefixes.push(` ${$blu('\u25a0')} `) // notice: blue
  } else if (level <= WARN) {
    prefixes.push(` ${$ylw('\u25a0')} `) // warning: yellow
  } else {
    prefixes.push(` ${$red('\u25a0')} `) // error: red
  }

  /* The prefix (task name and level) */
  prefixes.push(logPrefix)
  const linePrefix = prefixes.join('')

  /* Now for the normal logging of all our parameters */
  const breakLength = _lineLength - _taskLength - logPrefix.length - 3 // 3 chas: space square space
  const message = formatWithOptions({ ..._inspectOptions, breakLength }, ...args)

  /* Write each individual line out */
  for (const line of message.split('\n')) {
    _output.write(zapSpinner)
    _output.write(linePrefix)
    _output.write(line)
    _output.write('\n')
  }
}

/* ========================================================================== */

/** Emit in plain text! (no colors) */
export const emitPlain: LogEmitter = (options: LogEmitterOptions, args: any[]): void => {
  const { taskName, level, prefix, indent } = options
  const logPrefix = prefix ? prefix : indent ? ''.padStart(indent * _indentSize) : ''

  const prefixes: string[] = []

  const pad = ''.padStart(_taskLength - taskName.length, ' ')
  prefixes.push(`${pad}${taskName}`)

  if (level <= TRACE) {
    prefixes.push(' \u2502  trace \u2502 ')
  } else if (level <= DEBUG) {
    prefixes.push(' \u2502  debug \u2502 ')
  } else if (level <= INFO) {
    prefixes.push(' \u2502   info \u2502 ')
  } else if (level <= NOTICE) {
    prefixes.push(' \u2502 notice \u2502 ')
  } else if (level <= WARN) {
    prefixes.push(' \u2502   warn \u2502 ')
  } else {
    prefixes.push(' \u2502  error \u2502 ')
  }

  /* The prefix (task name and level) */
  prefixes.push(logPrefix)
  const linePrefix = prefixes.join('')

  /* Now for the normal logging of all our parameters */
  const breakLength = _lineLength - _taskLength - logPrefix.length - 12 // 12 chars of the level above
  const message = formatWithOptions({ ..._inspectOptions, breakLength }, ...args)

  /* Write each individual line out */
  for (const line of message.split('\n')) {
    _output.write(linePrefix)
    _output.write(line)
    _output.write('\n')
  }
}
