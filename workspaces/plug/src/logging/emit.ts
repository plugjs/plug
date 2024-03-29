import { formatWithOptions } from 'node:util'

import { fail } from '../asserts'
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
let _inspectOptions = { ...logOptions.inspectOptions }
logOptions.on('changed', (options) => {
  _output = options.output
  _indentSize = options.indentSize
  _taskLength = options.taskLength
  _lineLength = options.lineLength
  _inspectOptions = { ...options.inspectOptions } // proxy
  _defaultEmitter =
    options.format === 'fancy' ? emitFancy :
    options.format === 'plain' ? emitPlain :
    fail(`Invalid log format "${logOptions.format}"`)
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

/** A {@link LogEmitter} function configurable with a specific emitter */
export interface ConfigurableLogEmitter extends LogEmitter {
  get emitter(): LogEmitter
  set emitter(emitter: LogEmitter | undefined)
}

/* ========================================================================== */

/** Emit in full colors with spinner support and whatnot! */
export const emitFancy: LogEmitter = (options: LogEmitterOptions, args: any[]): void => {
  const { taskName, level, prefix = '', indent = 0 } = options
  const logPrefix = ''.padStart(indent * _indentSize) + prefix

  /* Prefixes, to prepend at the beginning of each line */
  const prefixes: string[] = []

  /* Task name or blank padding */
  prefixes.push(''.padStart(_taskLength - taskName.length, ' ')) // padding
  prefixes.push(`${$t(taskName, false)}`) // task name

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
    _output.write(`${zapSpinner}${linePrefix}${line}\n`)
  }
}

/* ========================================================================== */

/** Emit in plain text (maybe with some colors?) */
export const emitPlain: LogEmitter = (options: LogEmitterOptions, args: any[]): void => {
  const { taskName, level, prefix = '', indent = 0 } = options
  const logPrefix = ''.padStart(indent * _indentSize) + prefix

  const prefixes: string[] = []

  const pad = ''.padStart(_taskLength - taskName.length, ' ')
  prefixes.push(`${pad}${$t(taskName, false)}`)

  if (level <= TRACE) {
    prefixes.push(` ${$gry('\u2502')} ${$gry(' trace')} ${$gry('\u2502')} `)
  } else if (level <= DEBUG) {
    prefixes.push(` ${$gry('\u2502')} ${$gry(' debug')} ${$gry('\u2502')} `)
  } else if (level <= INFO) {
    prefixes.push(` ${$gry('\u2502')} ${$grn('  info')} ${$gry('\u2502')} `)
  } else if (level <= NOTICE) {
    prefixes.push(` ${$gry('\u2502')} ${$blu('notice')} ${$gry('\u2502')} `)
  } else if (level <= WARN) {
    prefixes.push(` ${$gry('\u2502')} ${$ylw('  warn')} ${$gry('\u2502')} `)
  } else {
    prefixes.push(` ${$gry('\u2502')} ${$red(' error')} ${$gry('\u2502')} `)
  }

  /* The prefix (task name and level) */
  prefixes.push(logPrefix)
  const linePrefix = prefixes.join('')

  /* Now for the normal logging of all our parameters */
  const breakLength = _lineLength - _taskLength - logPrefix.length - 12 // 12 chars of the level above
  const message = formatWithOptions({ ..._inspectOptions, breakLength }, ...args)

  /* Write each individual line out */
  for (const line of message.split('\n')) {
    _output.write(`${linePrefix}${line}\n`)
  }
}

/* ========================================================================== */

export interface ForkedLogMessage {
  logLevel: LogLevel,
  taskName: string,
  lines: string[],
}

/** Emit to the parent process of a forked child, or to the default emitter */
export const emitForked: LogEmitter = (options: LogEmitterOptions, args: any[]): void => {
  if (process.connected && process.send) {
    const { taskName, level, prefix = '', indent = 0 } = options
    const linePrefix = ''.padStart(indent * _indentSize) + prefix

    /* Now for the normal logging of all our parameters */
    const breakLength = _lineLength - _taskLength - linePrefix.length - 20
    const message = formatWithOptions({ ..._inspectOptions, breakLength }, ...args)

    /* Format each individual line */
    const lines = message.split('\n').map((line) => `${linePrefix}${line}`)

    /* Send the message to the parent process */
    process.send({ logLevel: level, taskName, lines })
  } else {
    _defaultEmitter(options, args)
  }
}

/* ========================================================================== */

/** The _default_ emitter (from `format`) */
let _defaultEmitter =
  logOptions.format === 'fancy' ? emitFancy :
  logOptions.format === 'plain' ? emitPlain :
  fail(`Invalid log format "${logOptions.format}"`)

/** The _actual_ emitter (either default or configured) */
let _emitter = _defaultEmitter

/** Our `emit` wrapper function to export */
const wrapper: LogEmitter = function emit(options: LogEmitterOptions, args: any[]): void {
  _defaultEmitter(options, args)
}

/** A _configurable_ {@link LogEmitter} where log should be emitted to */
export const emit = Object.defineProperty(wrapper, 'emitter', {
  get: () => _emitter,
  set: (emitter: LogEmitter | undefined) => {
    _emitter = emitter || _defaultEmitter
  },
}) as ConfigurableLogEmitter
