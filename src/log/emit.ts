import { formatWithOptions } from 'node:util'

import { buildFailed } from '../symbols'
import { $blu, $grn, $gry, $red, $t, $ylw } from './colors'
import { DEBUG, INFO, LogLevel, NOTICE, TRACE, WARN } from './levels'
import { logOptions } from './options'
import { zapSpinner } from './spinner'

/* ========================================================================== */

/* Initial value of log colors, and subscribe to changes */
let _output = logOptions.output
let _colors = logOptions.colors
let _indentSize = logOptions.indentSize
let _taskLength = logOptions.taskLength
let _lineLength = logOptions.lineLength
let _inspectOptions = logOptions.inspectOptions
logOptions.on('changed', (options) => {
  _output = options.output
  _colors = options.colors
  _indentSize = options.indentSize
  _taskLength = options.taskLength
  _lineLength = options.lineLength
  _inspectOptions = options.inspectOptions
})

/* ========================================================================== *
 * EMIT TEXT FOR LOGS / REPORTS                                               *
 * ========================================================================== */

const whiteSquare = '\u25a1'
const blackSquare = '\u25a0'

interface EmitOptions {
  taskName: string,
  level: LogLevel,
  indent?: number,
  prefix?: string,
}

/** Emit either plain or color */
export function emit(options: EmitOptions, args: any[]): void {
  const { taskName: task, level, prefix, indent = 0 } = options

  /* Strip any "buildFailed" argument (as it's already logged) */
  const params = args.filter((arg) => arg !== buildFailed)
  if (params.length === 0) return

  /* Prefix, either specified or from indenting level */
  const pfx = prefix ? prefix : indent ? ''.padStart(indent * _indentSize) : ''

  /* Log in colors or plain text */
  _colors ? emitColor(task, level, pfx, params) : emitPlain(task, level, pfx, params)
}

/* ========================================================================== */

/** Emit in full colors! */
function emitColor(task: string, level: LogLevel, pfx: string, args: any[]): void {
  /* Prefixes, to prepend at the beginning of each line */
  const prefixes: string[] = []

  /* Task name or blank padding */
  if (task) {
    prefixes.push(''.padStart(_taskLength - task.length, ' ')) // padding
    prefixes.push(`${$t(task)}`) // task name
  } else {
    prefixes.push(''.padStart(_taskLength, ' ')) // full width padding
  }

  /* Level indicator (our little colorful squares) */
  if (level <= TRACE) {
    prefixes.push(` ${$gry(whiteSquare)} `) // trace: gray open
  } else if (level <= DEBUG) {
    prefixes.push(` ${$gry(blackSquare)} `) // debug: gray
  } else if (level <= INFO) {
    prefixes.push(` ${$grn(blackSquare)} `) // info: green
  } else if (level <= NOTICE) {
    prefixes.push(` ${$blu(blackSquare)} `) // notice: blue
  } else if (level <= WARN) {
    prefixes.push(` ${$ylw(blackSquare)} `) // warning: yellow
  } else {
    prefixes.push(` ${$red(blackSquare)} `) // error: red
  }

  /* The prefix (task name and level) */
  prefixes.push(pfx)
  const prefix = prefixes.join('')

  /* Now for the normal logging of all our parameters */
  const breakLength = _lineLength - _taskLength - pfx.length - 3 // 3 chas: space square space
  const message = formatWithOptions({ ..._inspectOptions, breakLength }, ...args)

  const prefixed = prefix ? message.replace(/^/gm, prefix) : message
  _output.write(`${zapSpinner}${prefixed}\n`)
}

/* ========================================================================== */

function emitPlain(task: string, level: LogLevel, pfx: string, args: any[]): void {
  const prefixes: string[] = []

  if (task) {
    const pad = ''.padStart(_taskLength - task.length, ' ')
    prefixes.push(`${pad}${task}`)
  } else {
    prefixes.push(''.padStart(_taskLength, ' '))
  }

  if (level <= 0) {
    prefixes.push(' \u2502        \u2502 ')
  } else if (level <= TRACE) {
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
  prefixes.push(pfx)
  const prefix = prefixes.join('')

  /* Now for the normal logging of all our parameters */
  const breakLength = _lineLength - _taskLength - pfx.length - 12 // 12 chars of the level above
  const message = formatWithOptions({ ..._inspectOptions, breakLength }, ...args)

  const prefixed = prefix ? message.replace(/^/gm, prefix) : message
  _output.write(`${prefixed}\n`)
}
