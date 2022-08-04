import { sep } from 'node:path'
import { formatWithOptions, InspectOptions } from 'node:util'

import { currentRun, runningTasks } from './async'
import { AbsolutePath, getCurrentWorkingDirectory, resolveRelativeChildPath } from './paths'

/* ========================================================================== *
 * TYPES                                                                      *
 * ========================================================================== */

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

/** Options for our {@link Logger} instances */
export interface LogOptions extends InspectOptions {
  /** The current level for logging. */
  level: LogLevel,
  /** Whether to log in colors or not. */
  colors: boolean,
  /** Width of the current terminal (if any) or `80`. */
  breakLength: number,
  /** The maximum length of a task name (for pretty alignment). */
  taskLength: number,
  /** The task name to be used by default if a task is not contextualized. */
  defaultTaskName: string,
}

/* ========================================================================== *
 * OPTIONS                                                                    *
 * ========================================================================== */

/** Our level numbers (internal) */
const _levels = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  OFF: Number.MAX_SAFE_INTEGER,
} as const

/* The current log level */
let _level: number = _levels.INFO
/* Log colors (default is stderr is a TTY) */
let _color = process.stderr.isTTY
/* Log width (if it's a tty, or 80) */
let _breakLength = process.stderr.columns || 80
/* The maximum width of all registered tasks */
let _taskLength = 0
/* The default task name */
let _defaultTaskName = ''

/** Shared instance of our {@link LogOptions}. */
export const logOptions: LogOptions = {
  get level(): LogLevel {
    if (_level <= _levels.TRACE) return 'TRACE'
    if (_level <= _levels.DEBUG) return 'DEBUG'
    if (_level <= _levels.INFO) return 'INFO'
    if (_level <= _levels.WARN) return 'WARN'
    if (_level <= _levels.ERROR) return 'ERROR'
    return 'OFF'
  },

  set level(level: LogLevel) {
    _level = level in _levels ? _levels[level] : _levels.INFO
  },

  get colors(): boolean {
    return _color
  },

  set colors(color: boolean) {
    _color = color
  },

  get breakLength(): number {
    return _breakLength
  },

  set breakLength(breakLength: number) {
    _breakLength = breakLength
  },

  get taskLength(): number {
    return _taskLength
  },

  set taskLength(taskLength: number) {
    _taskLength = taskLength
  },

  get defaultTaskName(): string {
    return _defaultTaskName
  },

  set defaultTaskName(defaultTaskName: string) {
    _defaultTaskName = defaultTaskName
  },
}

/* Initialize from environment variables */
;(function init(): void {
  /* The `LOG_OPTIONS` variable is a JSON-serialized `LogOptions` object */
  Object.assign(logOptions, JSON.parse(process.env.LOG_OPTIONS || '{}'))

  /* The `LOG_LEVEL` variable is one of our `debug`, `info`, ... */
  if (process.env.LOG_LEVEL) {
    logOptions.level = process.env.LOG_LEVEL.toUpperCase() as LogLevel
  }

  /* If the `LOG_COLOR` variable is specified, it should be `true` or `false` */
  if (process.env.LOG_COLOR) {
    if (process.env.LOG_COLOR.toLowerCase() === 'true') logOptions.colors = true
    if (process.env.LOG_COLOR.toLowerCase() === 'false') logOptions.colors = false
    // Other values don't change the value of `options.colors`
  }
})()

/* ========================================================================== *
 * LOGGER IMPLEMENTATION                                                      *
 * ========================================================================== */

/** Default implementation of the {@link Logger} interface. */
class LoggerImpl implements Logger {
  #task

  constructor(task: string) {
    this.#task = task
  }

  trace(...args: any[]): this {
    if (_level > _levels.TRACE) return this
    emit(this.#task, _levels.TRACE, ...args)
    return this
  }

  debug(...args: any[]): this {
    if (_level > _levels.DEBUG) return this
    emit(this.#task, _levels.DEBUG, ...args)
    return this
  }

  info(...args: any[]): this {
    if (_level > _levels.INFO) return this
    emit(this.#task, _levels.INFO, ...args)
    return this
  }

  warn(...args: any[]): this {
    if (_level > _levels.WARN) return this
    emit(this.#task, _levels.WARN, ...args)
    return this
  }

  error(...args: any[]): this {
    if (_level > _levels.ERROR) return this
    emit(this.#task, _levels.ERROR, ...args)
    return this
  }

  sep(): this {
    separateLines = true
    return this
  }
}

/** Cache of loggers by task-name. */
const _loggers = new Map<string, Logger>()

/** Return a {@link Logger} associated with the specified task name. */
export function getLogger(task: string = _defaultTaskName): Logger {
  let logger = _loggers.get(task)
  if (! logger) {
    logger = new LoggerImpl(task)
    _loggers.set(task, logger)
  }
  return logger
}


/* ========================================================================== *
 * LOGGERS, SHARED (AUTOMATIC TASK DETECTION) AND PER-TASK                    *
 * ========================================================================== */

/** Get the logger from the current {@link Run} or with the default task name */
function _defaultLogger(): Logger {
  return currentRun()?.log || getLogger(_defaultTaskName)
}

/** Our shared {@link Logger} instance */
export const log: Logger = {
  trace(...args: any[]): Logger {
    if (_level > _levels.TRACE) return log
    _defaultLogger().trace(...args)
    return log
  },

  debug(...args: any[]): Logger {
    if (_level > _levels.DEBUG) return log
    _defaultLogger().debug(...args)
    return log
  },

  info(...args: any[]): Logger {
    if (_level > _levels.INFO) return log
    _defaultLogger().info(...args)
    return log
  },

  warn(...args: any[]): Logger {
    if (_level > _levels.WARN) return log
    _defaultLogger().warn(...args)
    return log
  },

  error(...args: any[]): Logger {
    if (_level > _levels.ERROR) return log
    _defaultLogger().error(...args)
    return log
  },

  sep(): Logger {
    separateLines = true
    return log
  },
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
const cyn = '\u001b[38;5;81m' // darker cyan

const tsk = '\u001b[38;5;141m' // the color for tasks (purple)

/* ========================================================================== */

/** Colorize an {@link AbsolutePath}. */
export function $p(path: AbsolutePath): string {
  const directory = getCurrentWorkingDirectory()
  const relative = resolveRelativeChildPath(directory, path)
  const resolved = relative == null ? path : `.${sep}${relative}`
  return _color ? `${und}${gry}${resolved}${rst}` : `"${resolved}"`
}

/** Colorize a _task name_. */
export function $t(task: string): string {
  return _color ?
    `${gry}"${tsk}${task}${gry}"${rst}` :
    `"${task}"`
}

/** Colorize in gray. */
export function $gry(string: any): string {
  return _color ? `${gry}${string}${rst}` : string
}

/** Colorize in red. */
export function $red(string: any): string {
  return _color ? `${red}${string}${rst}` : string
}

/** Colorize in green. */
export function $grn(string: any): string {
  return _color ? `${grn}${string}${rst}` : string
}

/** Colorize in yellow. */
export function $ylw(string: any): string {
  return _color ? `${ylw}${string}${rst}` : string
}

/** Colorize in blue. */
export function $blu(string: any): string {
  return _color ? `${blu}${string}${rst}` : string
}

/** Colorize in magenta. */
export function $mgt(string: any): string {
  return _color ? `${mgt}${string}${rst}` : string
}

/** Colorize in cyan. */
export function $cyn(string: any): string {
  return _color ? `${cyn}${string}${rst}` : string
}

/** Underline. */
export function $und(string: any): string {
  return _color ? `${und}${string}${rst}` : string
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
  if (! _color) return
  const tasks = runningTasks()
  if (! tasks.length) return

  const pad = ''.padStart(_taskLength, ' ')
  const names = tasks.map((task) => $t(task)).join(`${gry}, `) + gry

  write(`${zap}${pad} ${nextSpin()}  Running ${tasks.length} tasks (${names})${rst}`)
}, 50).unref()

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

let lastTask: string = _defaultTaskName
let separateLines: boolean = false

const whiteSquare = '\u25a1'
const blackSquare = '\u25a0'

/** Emit either plain or color */
function emit(task: string, level: number, ...args: any[]): void {
  return _color ?
    emitColor(task, level, ...args) :
    emitPlain(task, level, ...args)
}

/** Emit in full colors! */
function emitColor(task: string, level: number, ...args: any[]): void {
  /* Prefixes, to prepend at the beginning of each line */
  const prefixes: string[] = []

  /* Task name or blank padding */
  if (task) {
    prefixes.push(''.padStart(_taskLength - task.length, ' ')) // padding
    prefixes.push(`${tsk}${task}`) // task name
  } else {
    prefixes.push(''.padStart(_taskLength, ' ')) // full width padding
  }

  /* Level indicator (our little colorful squares) */
  if (level <= _levels.DEBUG) {
    prefixes.push(` ${gry}${whiteSquare}${rst} `) // trace/debug: gray open
  } else if (level <= _levels.INFO) {
    prefixes.push(` ${gry}${blackSquare}${rst} `) // info: gray
  } else if (level <= _levels.WARN) {
    prefixes.push(` ${ylw}${blackSquare}${rst} `) // warning: yellow
  } else {
    prefixes.push(` ${red}${blackSquare}${rst} `) // error: red
  }

  /* The prefix (task name and level) */
  const prefix = prefixes.join('')

  /* If we need to separate entries, do it now */
  if (separateLines) {
    if (lastTask != task) {
      write(`${zap}\n`)
    } else {
      write(`${zap}${prefix}\n`)
    }
    separateLines = false
  }
  lastTask = task

  /* Now for the normal logging of all our parameters */
  const breakLength = _breakLength - _taskLength - 3 // 3 chas: space square space
  const message = formatWithOptions({ ...logOptions, breakLength }, ...args)

  const prefixed = prefix ? message.replace(/^/gm, prefix) : message
  write(`${zap}${prefixed}\n`)
}

function emitPlain(task: string, level: number, ...args: any[]): void {
  const prefixes: string[] = []

  if (task) {
    const pad = ''.padStart(_taskLength - task.length, ' ')
    prefixes.push(`${pad}${task} \u2502`)
  } else {
    prefixes.push(''.padStart(_taskLength + 1, ' ') + '\u2502')
  }

  if (level <= _levels.TRACE) {
    prefixes.push( 'trace \u2502 ')
  } else if (level <= _levels.DEBUG) {
    prefixes.push( 'debug \u2502 ')
  } else if (level <= _levels.INFO) {
    prefixes.push('  info \u2502 ')
  } else if (level <= _levels.WARN) {
    prefixes.push('  warn \u2502 ')
  } else {
    prefixes.push(' error \u2502 ')
  }

  /* The prefix (task name and level) */
  const prefix = prefixes.join('')

  /* If we need to separate entries, do it now */
  if (separateLines) {
    write(`${prefix}\n`)
    separateLines = false
  }

  /* Now for the normal logging of all our parameters */
  const breakLength = 80 - _taskLength - 11 // 11 chars: evenly spaced level
  const message = formatWithOptions({ ...logOptions, breakLength }, ...args)

  const prefixed = prefix ? message.replace(/^/gm, prefix) : message
  write(`${prefixed}\n`)
}

function write(value: string): void {
  process.stderr.write(Buffer.from(value, 'utf-8'))
}
