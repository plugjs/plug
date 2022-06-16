import { AsyncLocalStorage } from 'node:async_hooks'
import { isatty } from 'node:tty'
import { inspect } from 'node:util'

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  OFF= 'OFF',
}

export interface Log {
  logLevel: LogLevel,
  logColor: boolean,

  debug: (...data: any[]) => void
  info: (...data: any[]) => void
  warn: (...data: any[]) => void
  error: (...data: any[]) => void
}

export const log: Log = {
  get logLevel(): LogLevel {
    if (logLevel <= levels.DEBUG) return LogLevel.DEBUG
    if (logLevel <= levels.INFO) return LogLevel.INFO
    if (logLevel <= levels.WARN) return LogLevel.WARN
    return LogLevel.ERROR
  },

  set logLevel(level: LogLevel) {
    logLevel = levels[level] || levels[LogLevel.INFO]
  },

  get logColor(): boolean {
    return logColor
  },

  set logColor(color: boolean) {
    logColor = !! color
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

export function taskName(): string | undefined {
  return asyncStorage.getStore()
}

export function runWithTaskName<T>(name: string, fn: () => T): T {
  return asyncStorage.run(name, fn)
}

/* ========================================================================== *
 * STATE                                                                      *
 * ========================================================================== */

const levels: { [ k in LogLevel ] : number } = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  OFF: Number.MAX_SAFE_INTEGER,
}

let logLevel = levels.INFO
let logColor = !! process.stderr.isTTY

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

const asyncStorage = new AsyncLocalStorage<string>()

const rst = '\u001b[0m'
const blk = '\u001b[38;5;240m'
const blkBg = '\u001b[48;5;239;38;5;16m'
const redBg = '\u001b[48;5;196;38;5;16m'
const ylwBg = '\u001b[48;5;226;38;5;16m'

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

  const task = taskName()
  if (task) {
    prefixStrings.push(`${blk}[${taskColor(task)}${task}${blk}]${rst}`)
    prefixLength += task.length + 2
  }

  if (level < levels.INFO) {
    prefixStrings.push(`${blkBg} DEBUG ${rst}`)
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

  const breakLength = (process.stderr.columns || 80) - prefixLength - 1
  const strings = args.map((arg) => {
    if (typeof arg === 'string') return arg
    return inspect(arg, { breakLength, colors: true })
  })

  const message = strings.join(' ')
  const marked = prefix ? message.replace(/^/gm, prefix) : message
  process.stderr.write(marked)
  process.stderr.write('\n')
}

function emitPlain(level: number, ...args: any[]) {
  const prefixStrings: string[] = []
  let prefixLength = 0

  const task = taskName()
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
  const strings = args.map((arg) => {
    if (typeof arg === 'string') return arg
    return inspect(arg, { breakLength, colors: false })
  })

  const message = strings.join(' ')
  const marked = prefix ? message.replace(/^/gm, prefix) : message
  process.stderr.write(marked)
  process.stderr.write('\n')
}
