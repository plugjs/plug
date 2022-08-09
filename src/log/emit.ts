import { formatWithOptions } from 'node:util'

import { $blu, $grn, $gry, $red, $t, $ylw } from './colors'
import { buildFailed } from './constants'
import { logLevels, LogLevelNumber, logOptions } from './options'
import { zapSpinner } from './spinner'

/* ========================================================================== */

/* Initial value of log colors, and subscribe to changes */
let _output = logOptions.output
let _colors = logOptions.colors
let _indentSize = logOptions.indentSize
let _taskLength = logOptions.taskLength
let _breakLength = logOptions.breakLength
logOptions.on('changed', ({ output, colors, indentSize, taskLength, breakLength }) => {
  _output = output
  _colors = colors
  _indentSize = indentSize
  _taskLength = taskLength
  _breakLength = breakLength
})

/* ========================================================================== *
 * EMIT TEXT FOR LOGS / REPORTS                                               *
 * ========================================================================== */

const whiteSquare = '\u25a1'
const blackSquare = '\u25a0'

interface EmitOptions {
  taskName: string,
  level: LogLevelNumber,
  indent?: number,
}

/** Emit either plain or color */
export function emit(options: EmitOptions, args: any[]): void {
  const { taskName: task, level, indent = 0 } = options

  /* Strip any "buildFailed" argument (as it's already logged) */
  const params = args.filter((arg) => arg !== buildFailed)
  if (params.length === 0) return

  /* Log in colors or plain text */
  _colors ? emitColor(task, level, indent, params) : emitPlain(task, level, indent, params)
}

/* ========================================================================== */

/** Emit in full colors! */
function emitColor(task: string, level: LogLevelNumber, indent: number, args: any[]): void {
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
  if (level <= logLevels.TRACE) {
    prefixes.push(` ${$gry(whiteSquare)} `) // trace: gray open
  } else if (level <= logLevels.DEBUG) {
    prefixes.push(` ${$gry(blackSquare)} `) // debug: gray
  } else if (level <= logLevels.INFO) {
    prefixes.push(` ${$grn(blackSquare)} `) // info: green
  } else if (level <= logLevels.NOTICE) {
    prefixes.push(` ${$blu(blackSquare)} `) // notice: blue
  } else if (level <= logLevels.WARN) {
    prefixes.push(` ${$ylw(blackSquare)} `) // warning: yellow
  } else {
    prefixes.push(` ${$red(blackSquare)} `) // error: red
  }

  /* The prefix (task name and level) */
  indent = indent * _indentSize
  prefixes.push(''.padStart(indent))
  const prefix = prefixes.join('')

  /* Now for the normal logging of all our parameters */
  const breakLength = _breakLength - _taskLength - indent - 3 // 3 chas: space square space
  const message = formatWithOptions({ ...logOptions, breakLength }, ...args)

  const prefixed = prefix ? message.replace(/^/gm, prefix) : message
  _output.write(`${zapSpinner}${prefixed}\n`)
}

/* ========================================================================== */

function emitPlain(task: string, level: LogLevelNumber, indent: number, args: any[]): void {
  const prefixes: string[] = []

  if (task) {
    const pad = ''.padStart(_taskLength - task.length, ' ')
    prefixes.push(`${pad}${task}`)
  } else {
    prefixes.push(''.padStart(_taskLength, ' '))
  }

  if (level <= 0) {
    prefixes.push(' \u2502        \u2502 ')
  } else if (level <= logLevels.TRACE) {
    prefixes.push(' \u2502  trace \u2502 ')
  } else if (level <= logLevels.DEBUG) {
    prefixes.push(' \u2502  debug \u2502 ')
  } else if (level <= logLevels.INFO) {
    prefixes.push(' \u2502   info \u2502 ')
  } else if (level <= logLevels.NOTICE) {
    prefixes.push(' \u2502 notice \u2502 ')
  } else if (level <= logLevels.WARN) {
    prefixes.push(' \u2502   warn \u2502 ')
  } else {
    prefixes.push(' \u2502  error \u2502 ')
  }

  /* The prefix (task name and level) */
  indent = indent * _indentSize
  prefixes.push(''.padStart(indent))
  const prefix = prefixes.join('')

  /* Now for the normal logging of all our parameters */
  const breakLength = _breakLength - _taskLength - indent - 12 // 12 chars of the level above
  const message = formatWithOptions({ ...logOptions, breakLength }, ...args)

  const prefixed = prefix ? message.replace(/^/gm, prefix) : message
  _output.write(`${prefixed}\n`)
}
