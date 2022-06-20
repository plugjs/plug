import type fs from 'node:fs'
import type tty from 'node:tty'

import { inspect, InspectOptions } from 'node:util'
import { currentTask, runningTasks } from './async'

/* ========================================================================== *
 * GENERIC LOGGING                                                            *
 * ========================================================================== */

/** Combine {@link fs.WriteStream} and {@link tty.WriteStream} */
export type WriteStream = fs.WriteStream | tty.WriteStream

/** A type identifying all our log levels */
export type LogLevel =
  | 'TRACE'
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'ERROR'
  | 'OFF'

/** Our {@link Log} interface */
export interface Log {
  /* The current logging options */
  options: {
    /** The {@link LogLevel} currently being logged */
    level: LogLevel,
    /** Whether to log with colors or not */
    colors: boolean,
    /** The current output */
    output: WriteStream
  }

  /** Log a `TRACE` message */
  trace: (message: string, ...data: any[]) => void
  /** Log a `DEBUG` message */
  debug: (message: string, ...data: any[]) => void
  /** Log an `INFO` message */
  info: (message: string, ...data: any[]) => void
  /** Log a `WARNING` message */
  warn: (message: string, ...data: any[]) => void
  /** Log an `ERROR` message */
  error: (message: string, ...data: any[]) => void
}

/** Our shared {@link Log} instance */
export const log: Log = {
  options: {
    get level(): LogLevel {
      if (logLevel <= levels.TRACE) return 'TRACE'
      if (logLevel <= levels.DEBUG) return 'DEBUG'
      if (logLevel <= levels.INFO) return 'INFO'
      if (logLevel <= levels.WARN) return 'WARN'
      if (logLevel <= levels.ERROR) return 'ERROR'
      return 'OFF'
    },

    set level(level: LogLevel) {
      logLevel = level in levels ? levels[level] : levels.INFO
    },

    get colors(): boolean {
      return logColor
    },

    set colors(color: boolean) {
      logColor = !! color
    },

    get output() {
      return logOutput
    },

    set output(output: WriteStream) {
      logColor = 'isTTY' in output ? !! output.isTTY : false
      logWidth = 'columns' in output ? output.columns : 80
      logOutput = output
    },
  },

  /* ------------------------------------------------------------------------ */

  trace(...args: any[]): void {
    if (logLevel > levels.TRACE) return
    emit(levels.TRACE, ...args)
  },

  debug(...args: any[]): void {
    if (logLevel > levels.DEBUG) return
    emit(levels.DEBUG, ...args)
  },

  info(...args: any[]): void {
    if (logLevel > levels.INFO) return
    emit(levels.INFO, ...args)
  },

  warn(...args: any[]): void {
    if (logLevel > levels.WARN) return
    emit(levels.WARN, ...args)
  },

  error(...args: any[]): void {
    if (logLevel > levels.ERROR) return
    emit(levels.ERROR, ...args)
  },
}

/* ========================================================================== *
 * BUILD FAILURES                                                             *
 * ========================================================================== */

/** A constant thrown by `Run` indicating a build failure already logged */
export const buildFailed = Symbol('Build failed')

/** Fail this `Run` giving a descriptive reason */
export function fail(reason: string, ...data: any[]): never
/** Fail this `Run` for the specified cause, with an optional reason */
export function fail(cause: unknown, reason?: string, ...args: any[]): never
// Overload!
export function fail(causeOrReason: unknown, ...args: any[]): never {
  /* We never have to log `buildFailed`, so treat it as undefined */
  if (causeOrReason === buildFailed) causeOrReason = undefined

  /* Nomalize our arguments, extracting cause and reason */
  const [ cause, reason ] =
    typeof causeOrReason === 'string' ?
      [ undefined, causeOrReason ] :
      [ causeOrReason, args.shift() as string | undefined ]

  /* Log our error if we have to */
  if (reason) {
    if (cause) args.push(cause)
    log.error(reason, ...args)
  } else if (cause) {
    log.error('Error', cause)
  }

  /* Failure handled, never log it again */
  throw buildFailed
}

/* ========================================================================== *
 * STATE                                                                      *
 * ========================================================================== */

/* Our level numbers (internal) */
const levels: { [ k in LogLevel ] : number } = {
  TRACE: 0,
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  OFF: Number.MAX_SAFE_INTEGER,
}

/* The current log level */
let logLevel: number = levels.INFO
/* The current log output */
let logOutput: WriteStream = process.stderr
/* Log colors (default is stderr is a TTY) */
let logColor = logOutput.isTTY
/* Log width (if it's a tty, or 80) */
let logWidth = logOutput.columns

/* ========================================================================== *
 * SPINNER                                                                    *
 * ========================================================================== */

const spins = [
  '\u2809', // ⠉ - 14
  '\u2819', // ⠙ - 145
  '\u2818', // ⠘ - 45
  '\u2838', // ⠸ - 456
  '\u2830', // ⠰ - 56
  '\u2834', // ⠴ - 356
  '\u2824', // ⠤ - 36
  '\u2826', // ⠦ - 236
  '\u2806', // ⠆ - 23
  '\u2807', // ⠇ - 123
  '\u2803', // ⠃ - 12
  '\u280b', // ⠋ - 124
]

let nextSpin = 0

setInterval(() => {
  if (! logColor) return
  const tasks = runningTasks()
  if (! tasks.length) return

  const spin = `${red}${spins[(nextSpin ++) % spins.length]}${gry}`

  const names = tasks
    .map((task) => `${taskColor(task.name)}${task.name}`)
    .join(`${gry}, `) + gry

  const count = `${red}${tasks.length}${gry}`
  write(`${zap}  ${spin} Running ${count} tasks (${names})${rst}`)
}, 100).unref()

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

const zap = '\u001b[0G\u001b[2K' // clear line and set column 0
const rst = '\u001b[0m' // reset all colors to default
const gry = '\u001b[38;5;240m' // somewhat gray
const red = '\u001b[38;5;203m' // light red (Leo's favorite)
const gryBg = '\u001b[48;5;239;38;5;16m' // gray background
const redBg = '\u001b[48;5;196;38;5;16m' // red background
const ylwBg = '\u001b[48;5;226;38;5;16m' // yellow background

const taskColor = (() => {
  const colors: string[] = [
    64, 69, 76, 81, 124, 129, 136, 141,
    148, 153, 201, 208, 213, 220 ]
      .map((color) => `\u001b[38;5;${color}m`)
      .sort(() => .5 - Math.random())

  let index = 0

  const tasks: Record<string, string> = {}

  return function taskColor(task: string): string {
    const color = tasks[task]
    if (color) return color
    return tasks[task] = colors[(index ++) % colors.length]
  }
})()

function emit(level: number, ...args: any[]) {
  return logColor ? emitColor(level, ...args) : emitPlain(level, ...args)
}

function emitColor(level: number, ...args: any[]) {
  const prefixStrings: string[] = []
  let prefixLength = 0

  const task = currentTask()?.name
  if (task) {
    prefixStrings.push(`${gry}[${taskColor(task)}${task}${gry}]${rst}`)
    prefixLength += task.length + 2
  }

  if (level < levels.DEBUG) {
    prefixStrings.push(`${gryBg} TRACE ${rst}`)
    prefixLength += 7
  } else if (level < levels.INFO) {
    prefixStrings.push(`${gryBg} DEBUG ${rst}`)
    prefixLength += 7
  } else if (level >= levels.ERROR) {
    prefixStrings.push(`${redBg} ERROR ${rst}`)
    prefixLength += 7
  } else if (level >= levels.WARN) {
    prefixStrings.push(`${ylwBg} WARNING ${rst}`)
    prefixLength += 9
  }

  const prefix = prefixStrings.length ? `${prefixStrings.join(' ')} ` : ''
  prefixLength += prefixStrings.length

  const breakLength = logWidth - prefixLength - 1
  const strings = stringifyArgs(args, { breakLength })

  const message = strings.join(' ')
  const prefixed = prefix ? message.replace(/^/gm, prefix) : message
  write(`${zap}${prefixed}\n`)
}

function emitPlain(level: number, ...args: any[]) {
  const prefixStrings: string[] = []
  let prefixLength = 0

  const task = currentTask()?.name
  if (task) {
    prefixStrings.push(`[${task}]`)
    prefixLength += task.length + 2
  }

  if (level < levels.INFO) {
    prefixStrings.push(`(DEBUG)`)
    prefixLength += 7
  } else if (level >= levels.ERROR) {
    prefixStrings.push(`(ERROR)`)
    prefixLength += 7
  } else if (level >= levels.WARN) {
    prefixStrings.push(`(WARNING)`)
    prefixLength += 9
  }

  const prefix = prefixStrings.length ? `${prefixStrings.join(' ')} ` : ''
  prefixLength += prefixStrings.length

  const breakLength = 79 - prefixLength
  const strings = stringifyArgs(args, { breakLength })

  const message = strings.join(' ')
  const prefixed = prefix ? message.replace(/^/gm, prefix) : message
  write(`${prefixed}\n`)
}

function stringifyArgs(args: any[], options: InspectOptions): string[] {
  return args.map((arg) => {
    if (arg === buildFailed) return undefined
    if (typeof arg === 'string') return arg
    if (arg instanceof Error) return arg.stack
    if ((typeof arg === 'function') && (typeof arg.task === 'function')) {
      return logColor ? `${taskColor(arg.name)}${arg.name}${rst}` : arg.name
    }
    return inspect(arg, { ...options, colors: logColor })
  }).filter((arg) => arg !== undefined) as string[]
}

function write(value: string) {
  (<any> logOutput).write(Buffer.from(value, 'utf-8'))
}
