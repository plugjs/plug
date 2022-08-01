import type fs from 'node:fs'
import type tty from 'node:tty'

import { sep } from 'node:path'
import { formatWithOptions } from 'node:util'
import { currentRun, currentTask, runningTasks } from './async'

import { AbsolutePath, resolveRelativeChildPath } from './paths'
import { EOL } from 'node:os'

/* ========================================================================== *
 * TYPES                                                                      *
 * ========================================================================== */

/** Constant thrown by `Run` indicating a build failure already logged */
// const buildFailed = Symbol.for('plugjs:build.failed')

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
  trace: (...data: any[]) => this
  /** Log a `DEBUG` message */
  debug: (...data: any[]) => this
  /** Log an `INFO` message */
  info: (...data: any[]) => this
  /** Log a `WARNING` message */
  warn: (...data: any[]) => this
  /** Log an `ERROR` message */
  error: (...data: any[]) => this
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
    /** The depth for object inspection */
    depth: number,

    readonly env: Record<string, any>,
  }
}

/* ========================================================================== *
 * STATE                                                                      *
 * ========================================================================== */

/* Our level numbers (internal) */
const levels = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  OFF: Number.MAX_SAFE_INTEGER,
} as const

/* The current log level */
let logLevel: number = levels.INFO
/* Log colors (default is stderr is a TTY) */
let logColor = process.stderr.isTTY
/* Log width (if it's a tty, or 80) */
const logWidth = process.stderr.columns || 80
/* Log depth (defaults to 2 as node) */
let logDepth = 2
/* The maximum width of all registered tasks */
let taskWidth = parseInt(process.env['LOG_TASK_WIDTH'] || '0') || 0
/** Last task name emitted by the log */
let lastTask: string | undefined
/** A marker to indicate that the next line must be separated */
let separateLines: boolean = false

/** The "default" task name */
const defaultTask: string | undefined = process.env['LOG_TASK_NAME']

/** Used internally to register task names, for width calculation and colors */
export function registerTask(task: string): void {
  if (task.length > taskWidth) taskWidth = task.length
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

    get depth() {
      return logDepth
    },

    set depth(depth: number) {
      logDepth = Math.floor(depth)
      if (logDepth <= 0) logDepth = 2
    },

    get env() {
      return {
        LOG_TASK_NAME: currentTask(),
        LOG_TASK_WIDTH: taskWidth,
      }
    },
  },

  /* ------------------------------------------------------------------------ */

  trace(...args: any[]): Log {
    if (logLevel > levels.TRACE) return log
    emit(currentTask(), '', levels.TRACE, ...args)
    return log
  },

  debug(...args: any[]): Log {
    if (logLevel > levels.DEBUG) return log
    emit(currentTask(), '', levels.DEBUG, ...args)
    return log
  },

  info(...args: any[]): Log {
    if (logLevel > levels.INFO) return log
    emit(currentTask(), '', levels.INFO, ...args)
    return log
  },

  warn(...args: any[]): Log {
    if (logLevel > levels.WARN) return log
    emit(currentTask(), '', levels.WARN, ...args)
    return log
  },

  error(...args: any[]): Log {
    if (logLevel > levels.ERROR) return log
    emit(currentTask(), '', levels.ERROR, ...args)
    return log
  },

  sep(): Log {
    separateLines = true
    return this
  },
}

/**
 * A {@link TaskLogger}  is a {@link Logger} always associated with the
 * task inferred at construction, and is useful when handling callbacks that
 * normally de-associate the calling execution stack.
 */
export class TaskLogger implements Logger {
  #task = currentTask()
  #prefix = ''

  constructor() {
    /* Nothing to do */
  }

  trace(...args: any[]): this {
    if (logLevel > levels.TRACE) return this
    emit(this.#task, this.#prefix, levels.TRACE, ...args)
    return this
  }

  debug(...args: any[]): this {
    if (logLevel > levels.DEBUG) return this
    emit(this.#task, this.#prefix, levels.DEBUG, ...args)
    return this
  }

  info(...args: any[]): this {
    if (logLevel > levels.INFO) return this
    emit(this.#task, this.#prefix, levels.INFO, ...args)
    return this
  }

  warn(...args: any[]): this {
    if (logLevel > levels.WARN) return this
    emit(this.#task, this.#prefix, levels.WARN, ...args)
    return this
  }

  error(...args: any[]): this {
    if (logLevel > levels.ERROR) return this
    emit(this.#task, this.#prefix, levels.ERROR, ...args)
    return this
  }

  sep(): this {
    separateLines = true
    return this
  }
}

/* ========================================================================== *
 * PRETTY COLORS                                                              *
 * ========================================================================== */

const zap = '\u001b[0G\u001b[2K' // clear line and set column 0
const rst = '\u001b[0m' // reset all colors to default

const und = '\u001b[4m' // underline on

const gry = '\u001b[38;5;240m' // somewhat gray
const red = '\u001b[38;5;203m' // light red (Leo's favorite)
const grn = '\u001b[38;5;76m' // greenish
const ylw = '\u001b[38;5;220m' // yellow
const blu = '\u001b[38;5;69m' // brighter blue
const mgt = '\u001b[38;5;213m' // pinky magenta
// const cyn = '\u001b[38;5;81m' // darker cyan

const tsk = '\u001b[38;5;141m' // the color for tasks (purple)

/* ========================================================================== */

export function $p(path: AbsolutePath): string {
  const directory = currentRun()?.baseDir || process.cwd() as AbsolutePath
  const relative = resolveRelativeChildPath(directory, path)
  const resolved = relative == null ? path : `.${sep}${relative}`
  return logColor ? `${und}${gry}${resolved}${rst}` : `"${resolved}"`
}

export function $t(task: string): string {
  return logColor ?
    `${gry}"${tsk}${task}${gry}"${rst}` :
    `"${task}"`
}

export function $gry(string: any): string {
  return logColor ? `${gry}${string}${rst}` : string
}

export function $red(string: any): string {
  return logColor ? `${red}${string}${rst}` : string
}

export function $grn(string: any): string {
  return logColor ? `${grn}${string}${rst}` : string
}

export function $ylw(string: any): string {
  return logColor ? `${ylw}${string}${rst}` : string
}

export function $blu(string: any): string {
  return logColor ? `${blu}${string}${rst}` : string
}

export function $mgt(string: any): string {
  return logColor ? `${mgt}${string}${rst}` : string
}

export function $cyn(string: any): string {
  return logColor ? `${tsk}${string}${rst}` : string
}

/* ========================================================================== *
 * SPINNER                                                                    *
 * ========================================================================== */

const nextSpin = ((): (() => string) => {
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
  const names = tasks.map((task) => $t(task)).join(`${gry}, `) + gry

  write(`${zap}${pad} ${nextSpin()}  Running ${tasks.length} tasks (${names})${rst}`)
}, 50).unref()

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

const whiteSquare = '\u25a1'
const blackSquare = '\u25a0'

/** Emit either plain or color */
function emit(task: string | undefined, prefix: string, level: number, ...args: any[]): void {
  // TODO: filter for `buildFailed`, check for empty lines, ...
  return logColor ?
    emitColor(task || defaultTask, prefix, level, ...args) :
    emitPlain(task || defaultTask, prefix, level, ...args)
}

/** Emit in full colors! */
function emitColor(task: string | undefined, prefix: string, level: number, ...args: any[]): void {
  /* Prefixes, to prepend at the beginning of each line */
  const prefixes: string[] = []

  /* Task name or blank padding */
  if (task) {
    prefixes.push(''.padStart(taskWidth - task.length, ' ')) // padding
    prefixes.push(`${tsk}${task}`) // task name
  } else {
    prefixes.push(''.padStart(taskWidth, ' ')) // full width padding
  }

  /* Level indicator (our little colorful squares) */
  if (level <= levels.DEBUG) {
    prefixes.push(` ${gry}${whiteSquare}${rst}`) // trace/debug: gray open
  } else if (level <= levels.INFO) {
    prefixes.push(` ${gry}${blackSquare}${rst}`) // info: gray
  } else if (level <= levels.WARN) {
    prefixes.push(` ${ylw}${blackSquare}${rst}`) // warning: yellow
  } else {
    prefixes.push(` ${red}${blackSquare}${rst}`) // error: red
  }

  /* The prefix (task name and level) */
  const prefix0 = prefixes.join('')

  /* If we need to separate entries, do it now */
  if (separateLines) {
    if (lastTask != task) {
      write(`${zap}\n`)
    } else {
      write(`${zap}${prefix0}\n`)
    }
    separateLines = false
  }
  lastTask = task

  /* The prefix (task name, level, and log prefix) */
  const prefix1 = prefix0 + '  ' + prefix

  /* Now for the normal logging of all our parameters */
  // eslint-disable-next-line no-control-regex
  const breakLength = logWidth - prefix1.replace(/\u001b\[[^m]+m/g, '').length
  const options = { breakLength, colors: logColor, depth: logDepth, compact: 1 }
  const strings = formatWithOptions(options, ...args).split(EOL)
  if (! strings.length) return // use sep()

  const message = strings.join(' ')
  const prefixed = prefix1 ? message.replace(/^/gm, prefix1) : message
  write(`${zap}${prefixed}\n`)
}

function emitPlain(task: string | undefined, prefix: string, level: number, ...args: any[]): void {
  const prefixes: string[] = []

  if (task) {
    const pad = ''.padStart(taskWidth - task.length, ' ')
    prefixes.push(`${pad}${task} \u2502`)
  } else {
    prefixes.push(''.padStart(taskWidth + 1, ' ') + '\u2502')
  }

  if (level <= levels.TRACE) {
    prefixes.push( 'trace \u2502 ')
  } else if (level <= levels.DEBUG) {
    prefixes.push( 'debug \u2502 ')
  } else if (level <= levels.INFO) {
    prefixes.push('  info \u2502 ')
  } else if (level <= levels.WARN) {
    prefixes.push('  warn \u2502 ')
  } else {
    prefixes.push(' error \u2502 ')
  }

  /* The prefix (task name and level) */
  const prefix0 = prefixes.join('')

  /* If we need to separate entries, do it now */
  if (separateLines) {
    write(`${prefix0}\n`)
    separateLines = false
  }

  /* The prefix (task name, level, and log prefix) */
  const prefix1 = prefix0 + prefix

  const breakLength = 80 - prefix1.length
  const options = { breakLength, colors: logColor, depth: logDepth, compact: 1 }
  const strings = formatWithOptions(options, ...args).split(EOL)
  if (! strings.length) return // use sep()

  const message = strings.join(' ')
  const prefixed = prefix0 ? message.replace(/^/gm, prefix1) : message
  write(`${prefixed}\n`)
}

function write(value: string): void {
  process.stderr.write(Buffer.from(value, 'utf-8'))
}
