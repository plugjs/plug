import type fs from 'node:fs'
import type tty from 'node:tty'

import { inspect } from 'node:util'
import { currentTask, runningTasks } from './async'

import type { Task } from './build'

/* ========================================================================== *
 * TYPES                                                                      *
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

/** A {@link Logger} emits log events */
export interface Logger {
  /** Log a `TRACE` message */
  trace: (message: string, ...data: any[]) => this
  /** Log a `DEBUG` message */
  debug: (message: string, ...data: any[]) => this
  /** Log an `INFO` message */
  info: (message: string, ...data: any[]) => this
  /** Log a `WARNING` message */
  warn: (message: string, ...data: any[]) => this
  /** Log an `ERROR` message */
  error: (message: string, ...data: any[]) => this
  /** Separate log entries */
  sep: () => this
}

/** Our {@link Log} interface */
export interface Log extends Logger {
  /* The current logging options */
  options: {
    /** The {@link LogLevel} currently being logged */
    level: LogLevel,
    /** Whether to log with colors or not */
    colors: boolean,
    /** The current output */
    output: WriteStream
    /** The depth for object inspection */
    depth: number,
  }
}

/* ========================================================================== *
 * STATE                                                                      *
 * ========================================================================== */

/* Our level numbers (internal) */
const levels = {
  TRACE: 0,
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  OFF: Number.MAX_SAFE_INTEGER,
} as const

/* The current log level */
let logLevel: number = levels.INFO
/* The current log output */
let logOutput: WriteStream = process.stderr
/* Log colors (default is stderr is a TTY) */
let logColor = logOutput.isTTY
/* Log width (if it's a tty, or 80) */
let logWidth = logOutput.columns || 80
/* Log depth (defaults to 2 as node) */
let logDepth = 2
/* The maximum width of all registered tasks */
let taskWidth = 0
/** Last task name emitted by the log */
let lastTask: string | undefined
/** True after the first log line is emitted */
let logStarted: boolean = false
/** A marker to indicate that the next line must be separated */
let separateLines: boolean = false

/** Used internally to register task names, for width calculation and colors */
export function registerTask(task: Task) {
  if (task.name.length > taskWidth) taskWidth = task.name.length
  tsk(task.name) // register the color already
}

/* ========================================================================== *
 * LOGGERS, SHARED (AUTOMATIC TASK DETECTION) AND PER-TASK                    *
 * ========================================================================== */

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

    get depth() {
      return logDepth
    },

    set depth(depth: number) {
      logDepth = Math.floor(depth)
      if (logDepth < 0) logDepth = 2
    },
  },

  /* ------------------------------------------------------------------------ */

  trace(...args: any[]): Log {
    if (logLevel > levels.TRACE) return log
    emit(currentTask(), levels.TRACE, ...args)
    return log
  },

  debug(...args: any[]): Log {
    if (logLevel > levels.DEBUG) return log
    emit(currentTask(), levels.DEBUG, ...args)
    return log
  },

  info(...args: any[]): Log {
    if (logLevel > levels.INFO) return log
    emit(currentTask(), levels.INFO, ...args)
    return log
  },

  warn(...args: any[]): Log {
    if (logLevel > levels.WARN) return log
    emit(currentTask(), levels.WARN, ...args)
    return log
  },

  error(...args: any[]): Log {
    if (logLevel > levels.ERROR) return log
    emit(currentTask(), levels.ERROR, ...args)
    return log
  },

  sep(): Log {
    separateLines = true
    return this
  }
}

/**
 * A {@link TaskLogger}  is a {@link Logger} always associated with the
 * task inferred at construction, and is useful when handling callbacks that
 * normally de-associate the calling execution stack.
 */
export class TaskLogger implements Logger {
  #task = currentTask()

  constructor() {
    /* Empty constructor */
  }

  trace(...args: any[]): this {
    if (logLevel > levels.TRACE) return this
    emit(this.#task, levels.TRACE, ...args)
    return this
  }

  debug(...args: any[]): this {
    if (logLevel > levels.DEBUG) return this
    emit(this.#task, levels.DEBUG, ...args)
    return this
  }

  info(...args: any[]): this {
    if (logLevel > levels.INFO) return this
    emit(this.#task, levels.INFO, ...args)
    return this
  }

  warn(...args: any[]): this {
    if (logLevel > levels.WARN) return this
    emit(this.#task, levels.WARN, ...args)
    return this
  }

  error(...args: any[]): this {
    if (logLevel > levels.ERROR) return this
    emit(this.#task, levels.ERROR, ...args)
    return this
  }

  sep(): this {
    separateLines = true
    return this
  }
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
    log.sep().error(reason, ...args)
  } else if (cause) {
    log.sep().error('Error', cause)
  }

  /* Failure handled, never log it again */
  throw buildFailed
}

/* ========================================================================== *
 * PRETTY COLORS                                                              *
 * ========================================================================== */

const zap = '\u001b[0G\u001b[2K' // clear line and set column 0
const rst = '\u001b[0m' // reset all colors to default

const uon = '\u001b[4m' // underline on
const uof = '\u001b[24m' // underline off

const gry = '\u001b[38;5;240m' // somewhat gray
const red = '\u001b[38;5;203m' // light red (Leo's favorite)
const grn = '\u001b[38;5;76m' // greenish
const ylw = '\u001b[38;5;220m' // yellow
const blu = '\u001b[38;5;69m' // brighter blue
const mgt = '\u001b[38;5;213m' // pinky magenta
const cyn = '\u001b[38;5;81m' // darker cyan

const gryBg = '\u001b[48;5;239;38;5;16m' // gray background
const redBg = '\u001b[48;5;196;38;5;16m' // red background
const ylwBg = '\u001b[48;5;226;38;5;16m' // yellow background

/** Prefix a task name with its color (remember, color is NOT reset) */
const tsk = (() => {
  const tasks: Record<string, string> = {}
  const colors = [ 64, 69, 76, 81, 124, 129, 136, 141, 148, 153, 201, 208, 213, 220 ]
  let index = 0

  return function tsk(task: string): string {
    const mapped = tasks[task]
    if (mapped) return mapped

    const color = colors[(index ++) % colors.length]
    const wrapped = `\u001b[38;5;${color}m${task}`
    return tasks[task] = wrapped
  }
})()

/* ========================================================================== */

export function $p(path: string): string {
  return logColor ? `${uon}${path}${uof}` : `"${path}"`
}

export function $t(task: Task): string {
  return logColor ?
    `${gry}"${tsk(task.name)}${gry}"${rst}` :
    `"${task}"`
}

export function $gry(string: any): string {
  return logColor ? `${gry}${string}${rst}` : string
}

export function $red(string: any) {
  return logColor ? `${red}${string}${rst}` : string
}

export function $grn(string: any) {
  return logColor ? `${grn}${string}${rst}` : string
}

export function $ylw(string: any) {
  return logColor ? `${ylw}${string}${rst}` : string
}

export function $blu(string: any) {
  return logColor ? `${blu}${string}${rst}` : string
}

export function $mgt(string: any) {
  return logColor ? `${mgt}${string}${rst}` : string
}

export function $cyn(string: any) {
  return logColor ? `${cyn}${string}${rst}` : string
}

/* ========================================================================== *
 * SPINNER                                                                    *
 * ========================================================================== */

const nextSpin = (() => {
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

  return () => spins[(nextSpin ++) % spins.length]
})()

setInterval(() => {
  if (! logColor) return
  const tasks = runningTasks()
  if (! tasks.length) return

  const pad = ''.padStart(taskWidth, ' ')
  const names = tasks.map((task) => tsk(task.name)).join(`${gry}, `) + gry

  write(`${zap}${pad} ${nextSpin()}  Running ${tasks.length} tasks (${names})${rst}`)
}, 50).unref()

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

const whiteSquare = '\u25a1'
const blackSquare = '\u25a0'

/** Emit either plain or color */
function emit(task: Task | undefined, level: number, ...args: any[]) {
  return logColor ? emitColor(task?.name, level, ...args) : emitPlain(task, level, ...args)
}

/** Emit in full colors! */
function emitColor(task: string | undefined, level: number, ...args: any[]) {
  /* Separate between different tasks */
  if ((lastTask !== task) && logStarted) {
    const pad = ''.padStart(taskWidth, ' ')
    write(`${zap}${pad} ${gry}${whiteSquare}${rst}\n`)
    separateLines = false
    lastTask = task
  }

  /* Definitely started */
  logStarted = true

  /* Prefixes, to prepend at the beginning of each line */
  const prefixes: string[] = []

  /* Task name or blank padding */
  if (task) {
    const pad = ''.padStart(taskWidth - task.length, ' ')
    prefixes.push(`${pad}${tsk(task)}`)
  } else {
    prefixes.push(''.padStart(taskWidth, ' '))
  }

  /* Level indicator (our little colorful squares) */
  if (level <= levels.DEBUG) {
    prefixes.push(`${gry}${whiteSquare}${rst}`) // trace/debug: gray open
  } else if (level <= levels.INFO) {
    prefixes.push(`${gry}${blackSquare}${rst}`) // info: gray
  } else if (level <= levels.WARN) {
    prefixes.push(`${ylw}${blackSquare}${rst}`) // warning: yellow
  } else {
    prefixes.push(`${red}${blackSquare}${rst}`) // error: red
  }

  /* The prefix to be prepended to all log entries */
  const prefix = prefixes.join(' ') + '  '

  /* If we need to separate entries, do it now */
  if (separateLines) {
    write(`${zap}${prefix}\n`)
    separateLines = false
  }

  /* Now for the normal logging of all our parameters */
  const breakLength = logWidth - taskWidth - 3
  const strings = stringifyArgs(args, breakLength)

  const message = strings.join(' ')
  const prefixed = prefix ? message.replace(/^/gm, prefix) : message
  write(`${zap}${prefixed}\n`)
}

function emitPlain(task: Task | undefined, level: number, ...args: any[]) {
  const prefixStrings: string[] = []
  let prefixLength = 0

  if (task) {
    const name = task.name
    const pad = ''.padStart(taskWidth - task.name.length, ' ')
    prefixStrings.push(`${pad}[${name}]`)
    prefixLength += name.length + pad.length + 2
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
  const strings = stringifyArgs(args, breakLength)

  const message = strings.join(' ')
  const prefixed = prefix ? message.replace(/^/gm, prefix) : message
  write(`${prefixed}\n`)
}

function stringifyArgs(args: any[], breakLength: number): string[] {
  return args.map((arg) => {
    if (arg === buildFailed) return undefined
    if (typeof arg === 'string') return arg
    if (arg instanceof Error) return arg.stack
    return inspect(arg, { breakLength, colors: logColor, depth: logDepth, compact: 1 })
  }).filter((arg) => arg !== undefined) as string[]
}

function write(value: string) {
  (<any> logOutput).write(Buffer.from(value, 'utf-8'))
}
