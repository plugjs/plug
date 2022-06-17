import { AsyncLocalStorage } from 'node:async_hooks'
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

  debug: (message: string, ...data: any[]) => void
  info: (message: string, ...data: any[]) => void
  warn: (message: string, ...data: any[]) => void
  error: (message: string, ...data: any[]) => void
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

export function runWithTaskName<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return asyncStorage.run(name, async () => {
    runningTasks.push(name)
    try {
      return await fn()
    } finally {
      const i = runningTasks.indexOf(name)
      if (i >= 0) runningTasks.splice(i, 1)
    }
  })
}

export function prettyfyTaskName(task: string): string {
  return logColor ? `${taskColor(task)}${task}${rst}` : task
}

/* ========================================================================== *
 * STATE                                                                      *
 * ========================================================================== */

const runningTasks: string[] = []

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
  if (! runningTasks.length) return

  const spin = `${red}${spins[(nextSpin ++) % spins.length]}${gry}`

  const tasks = runningTasks
    .map((task) => `${taskColor(task)}${task}`)
    .join(`${gry}, `) + gry

  const count = `${red}${runningTasks.length}${gry}`

  process.stderr.write(`${zap}  ${spin} Running ${count} tasks (${tasks})${rst}`)
}, 100).unref()

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

const asyncStorage = new AsyncLocalStorage<string>()

const zap = '\u001b[0G\u001b[2K' // clear line and set column 0
const rst = '\u001b[0m' // reset all colors to default
const gry = '\u001b[38;5;240m' // somewhat gray
const red = '\u001b[38;5;203m' // light red (Leo's favorite)
const ylw = '\u001b[38;5;184m' // shaded yellow
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

  const task = taskName()
  if (task) {
    prefixStrings.push(`${gry}[${taskColor(task)}${task}${gry}]${rst}`)
    prefixLength += task.length + 2
  }

  if (level < levels.INFO) {
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

  const breakLength = (process.stderr.columns || 80) - prefixLength - 1
  const strings = args.map((arg) => {
    if (typeof arg === 'string') return arg
    return inspect(arg, { breakLength, colors: true })
  })

  const message = strings.join(' ')
  const prefixed = prefix ? message.replace(/^/gm, prefix) : message
  process.stderr.write(`${zap}${prefixed}\n`)
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
  const prefixed = prefix ? message.replace(/^/gm, prefix) : message
  process.stderr.write(`${prefixed}\n`)
}
