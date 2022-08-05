import { sep } from 'node:path'
import { formatWithOptions, InspectOptions } from 'node:util'

import { currentRun, runningTasks } from './async'
import { AbsolutePath, getCurrentWorkingDirectory, resolveRelativeChildPath } from './paths'

/* ========================================================================== *
 * TYPES                                                                      *
 * ========================================================================== */

/** Constant thrown indicating a build failure already logged */
export const buildFailed = Symbol.for('plugjs:build.failed')

/** A type identifying all our log levels */
export type LogLevel =
  | 'TRACE'
  | 'DEBUG'
  | 'INFO'
  | 'NOTICE'
  | 'WARN'
  | 'ERROR'
  | 'OFF'

/** A {@link Logger} emits log events */
export interface Logger {
  /** Log a `TRACE` message */
  trace: (...args: [ any, ...any ]) => this
  /** Log a `DEBUG` message */
  debug: (...args: [ any, ...any ]) => this
  /** Log an `INFO` message */
  info: (...args: [ any, ...any ]) => this
  /** Log a `NOTICE` message */
  notice: (...args: [ any, ...any ]) => this
  /** Log a `WARNING` message */
  warn: (...args: [ any, ...any ]) => this
  /** Log an `ERROR` message */
  error: (...args: [ any, ...any ]) => this
  /** Log a `FAIL` message and throw */
  fail: (...args: [ any, ...any ]) => never
  /** Log a `FAIL` message and throw */
  report: (title: string) => Report
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

/** Counters for records in a {@link Report} */
export interface ReportStats {
  /** The number of `notice` records in this {@link Report}. */
  readonly notices: number
  /** The number of `warning` records in this {@link Report}. */
  readonly warnings: number
  /** The number of `error` records in this {@link Report}. */
  readonly errors: number
  /** The number _all_ records in this {@link Report}. */
  readonly records: number
}

/** A record for a {@link Report} */
export interface ReportRecord {
  /** The _level_ (or _severity_) of this {@link ReportRecord}. */
  readonly level: Extract<LogLevel, 'NOTICE' | 'WARN' | 'ERROR'>,
  /** A detail message to associate with this {@link ReportRecord}. */
  readonly message: string | string[]

  /**
   * Tags to associate with this{@link ReportRecord}.
   *
   * Those are error categories, or error codes and are directly related with
   * whatever produced the {@link Report}.
   */
  readonly tags?: string [] | string | null | undefined

  /** Line number in the source code (starting at `1`) */
  readonly line?: number | null | undefined
  /** Column number in the source code (starting at `1`) */
  readonly column?: number | null | undefined
  /** Number of characters involved (`-1` means until the end of the line ) */
  readonly length?: number | null | undefined

  /** The {@link AbsolutePath} of the file associated with this. */
  readonly file?: AbsolutePath | null | undefined,
  /** The _real source code_ associated with this (for error higlighting). */
  readonly source?: string | null | undefined
}

/** A {@link Report} that will standardise the way we output information. */
export interface Report extends ReportStats {
  /** Add a new {@link ReportRecord | record} to this {@link Report}. */
  add(...records: ReportRecord[]): this
  /** Emit this {@link Report}. */
  emit(showSources?: boolean | undefined): this
  /**
   * Fail the build.
   *
   * Useful in chained constructs like:
   *
   * ```
   * if (report.errors) report.emit().fail()
   * ```
   */
  fail(...args: any[]): never
}

/* ========================================================================== *
 * OPTIONS                                                                    *
 * ========================================================================== */

/** Our level numbers (internal) */
const _levels = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  NOTICE: 40,
  WARN: 50,
  ERROR: 60,
  OFF: Number.MAX_SAFE_INTEGER,
} as const

/* The current log level */
let _level: number = _levels.NOTICE
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
    if (_level <= _levels.NOTICE) return 'NOTICE'
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
  constructor(private readonly _task: string) {}

  trace(...args: [ any, ...any ]): this {
    if (_level > _levels.TRACE) return this
    emit(this._task, _levels.TRACE, ...args)
    return this
  }

  debug(...args: [ any, ...any ]): this {
    if (_level > _levels.DEBUG) return this
    emit(this._task, _levels.DEBUG, ...args)
    return this
  }

  info(...args: [ any, ...any ]): this {
    if (_level > _levels.INFO) return this
    emit(this._task, _levels.INFO, ...args)
    return this
  }

  notice(...args: [ any, ...any ]): this {
    if (_level > _levels.NOTICE) return this
    emit(this._task, _levels.NOTICE, ...args)
    return this
  }

  warn(...args: [ any, ...any ]): this {
    if (_level > _levels.WARN) return this
    emit(this._task, _levels.WARN, ...args)
    return this
  }

  error(...args: [ any, ...any ]): this {
    if (_level > _levels.ERROR) return this
    emit(this._task, _levels.ERROR, ...args)
    return this
  }

  fail(...args: [ any, ...any ]): never {
    if (args.includes(buildFailed)) throw buildFailed
    emit(this._task, _levels.ERROR, ...args)
    throw buildFailed
  }

  report(title: string): Report {
    return new ReportImpl(this, this._task, title)
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

/** The generic, shared `log` function type. */
export type Log = ((...args: [ any, ...any ]) => void) & Logger

/** Our logging function (defaulting to the `NOTICE` level) */
export const log: Log = ((): Log => {
  /* Return either the current run's log, or the default task's logger */
  const logger = (): Logger => (currentRun()?.log || getLogger(_defaultTaskName))

  /* Create a Logger wrapping the current logger */
  const wrapper: Logger = {
    trace(...args: [ any, ...any ]): Logger {
      if (_level > _levels.TRACE) return wrapper
      logger().trace(...args)
      return wrapper
    },

    debug(...args: [ any, ...any ]): Logger {
      if (_level > _levels.DEBUG) return wrapper
      logger().debug(...args)
      return wrapper
    },

    info(...args: [ any, ...any ]): Logger {
      if (_level > _levels.INFO) return wrapper
      logger().info(...args)
      return wrapper
    },

    notice(...args: [ any, ...any ]): Logger {
      if (_level > _levels.NOTICE) return wrapper
      logger().notice(...args)
      return wrapper
    },

    warn(...args: [ any, ...any ]): Logger {
      if (_level > _levels.WARN) return wrapper
      logger().warn(...args)
      return wrapper
    },

    error(...args: [ any, ...any ]): Logger {
      if (_level > _levels.ERROR) return wrapper
      logger().error(...args)
      return wrapper
    },

    fail(...args: [ any, ...any ]): never {
      // Dunno why TS thinks that `logger().fail(... args)` can return
      const log: Logger = logger()
      log.fail(...args)
    },

    report(title: string): Report {
      return logger().report(title)
    },
  }

  /* Create a function that will default logging to "NOTICE" */
  const log = (...args: [ any, ...any ]): void => void wrapper.notice(...args)

  /* Return our function, with added Logger implementation */
  return Object.assign(log, wrapper)
})()

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
const wht = '\u001b[1;38;5;255m' // full-bright white

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

/** Colorize in white. */
export function $wht(string: any): string {
  return _color ? `${wht}${string}${rst}` : string
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

  const task = tasks.length > 1 ? 'tasks' : 'task'

  write(`${zap}${pad} ${nextSpin()}  Running ${tasks.length} ${task}: ${names}${rst}`)
}, 50).unref()

/* ========================================================================== *
 * REPORT IMPLEMENTATION                                                      *
 * ========================================================================== */

interface ReportInternalRecord {
  readonly level: typeof _levels['NOTICE' | 'WARN' |'ERROR']
  readonly messages: readonly string[]
  readonly tags: readonly string[]
  readonly line: number
  readonly column: number
  readonly length: number
}


class ReportImpl implements Report {
  private readonly _sources = new Map<AbsolutePath, string[]>()
  private readonly _records = new Map<AbsolutePath | undefined, Set<ReportInternalRecord>>()
  private _notices = 0
  private _warnings = 0
  private _errors = 0

  constructor(
      private readonly _log: Logger,
      private readonly _task: string,
      private readonly _title: string,
  ) {}

  get notices(): number {
    return this._notices
  }

  get warnings(): number {
    return this._warnings
  }

  get errors(): number {
    return this._errors
  }

  get records(): number {
    return this._notices + this._warnings + this._errors
  }

  add(...records: ReportRecord[]): this {
    for (const record of records) {
      /* Normalize the basic entries in this message */
      let messages =
        Array.isArray(record.message) ?
            [ ...record.message ] :
            record.message.split('\n')
      messages = messages.filter((message) => !! message)
      if (! messages.length) this._log.fail('No message for report record')

      const file = record.file || undefined
      const source = record.source || undefined
      const tags = record.tags ?
        Array.isArray(record.tags) ?
            [ ...record.tags ] :
            [ record.tags ] :
            []

      const level =
        record.level === 'NOTICE' ? _levels.NOTICE :
        record.level === 'WARN' ? _levels.WARN :
        record.level === 'ERROR' ? _levels.ERROR :
        this._log.fail(`Wrong record level "${record.level}"`)

      switch (level) {
        case _levels.NOTICE: this._notices ++; break
        case _levels.WARN: this._warnings ++; break
        case _levels.ERROR: this._errors ++; break
      }

      /* Line, column and characters are a bit more complicated */
      let line: number = 0
      let column: number = 0
      let length: number = 1

      if (file && record.line) {
        line = record.line
        if (record.column) {
          column = record.column
          if (record.length) {
            length = record.length
            if (length < 0) {
              length = Number.MAX_SAFE_INTEGER
            }
          }
        }
      }

      /* Remember our source code, line by line */
      if ((file && source) && (! this._sources.has(file))) {
        this._sources.set(file, source.split('\n'))
      }

      /* Remember this normalized report */
      let reports = this._records.get(file)
      if (! reports) this._records.set(file, reports = new Set())
      reports.add({ level, messages, tags, line, column, length: length })
    }

    /* All done */
    return this
  }

  emit(showSources = false): this {
    /* Counters for all we need to print nicely */
    let mPad = 0
    let lPad = 0
    let cPad = 0

    for (const records of this._records.values()) {
      for (const record of records) {
        if (record.line && (record.line > lPad)) lPad = record.line
        if (record.column && (record.column > cPad)) cPad = record.column
        for (const message of record.messages) {
          if (message.length > mPad) mPad = message.length
        }
      }
    }

    mPad = mPad <= 100 ? mPad : 0 // limit length of padding for breakaway lines
    lPad = lPad.toString().length
    cPad = cPad.toString().length

    emit(this._task, 0, '')
    emit(this._task, 0, $und($wht(this._title)))

    /* Sort our map of file => reports by file name (undefined first) */
    const entries = [ ...this._records.entries() ]
        .sort(([ a ], [ b ]) =>
          ((a || '') < (b || '')) ? -1 : ((a || '') > (b || '')) ? 1 : 0)

    /* Iterate through all our [file,reports] tuple */
    for (let f = 0; f < entries.length; f ++) {
      const [ file, unsortedRecords ] = entries[f]
      const source = file && this._sources.get(file)

      emit(this._task, 0, '')
      if (file) emit(this._task, 0, $wht($und(file)))

      /* Sort the report messages by line/column */
      const sortedRecords = [ ...unsortedRecords ]
          .sort(({ line: al, column: ac }, { line: bl, column: bc }) =>
            ((al || Number.MAX_SAFE_INTEGER) - (bl || Number.MAX_SAFE_INTEGER)) ||
            ((ac || Number.MAX_SAFE_INTEGER) - (bc || Number.MAX_SAFE_INTEGER)) )

      /* Now get each message and do our magic */
      for (let r = 0; r < sortedRecords.length; r ++) {
        const { level, messages, tags, line, column, length = 1 } = sortedRecords[r]

        /* Prefix includes line and column */
        let pfx: string
        if (file && line) {
          if (column) {
            pfx = `  ${line.toString().padStart(lPad)}:${column.toString().padEnd(cPad)} `
          } else {
            pfx = `  ${line.toString().padStart(lPad)}:${'-'.padEnd(cPad)} `
          }
        } else {
          pfx = `  ${'-'.padStart(lPad)}:${'-'.padEnd(cPad)} `
        }
        const pfx2 = ''.padStart(pfx.length)

        /* Nice tags */
        const tag = tags.length == 0 ? '' :
          `${$gry('[')}${tags.map((tag) => $blu(tag)).join($gry('|'))}${$gry(']')}`

        /* Print out our messages, one by one */
        if (messages.length === 1) {
          emit(this._task, level, $gry(pfx), messages[0].padEnd(mPad), tag)
        } else {
          for (let m = 0; m < messages.length; m ++) {
            if (! m) { // first line
              emit(this._task, level, $gry(pfx), messages[m])
            } else if (m === messages.length - 1) { // last line
              emit(this._task, level, $gry(pfx2), messages[m].padEnd(mPad), tag)
            } else { // in between lines
              emit(this._task, level, $gry(pfx2), messages[m])
            }
          }
        }

        /* See if we have to / can print out the source */
        if (showSources && source && source[line - 1]) {
          if (column) {
            const $col = level === _levels.NOTICE ? $blu : level === _levels.WARN ? $ylw : $red
            const offset = column - 1
            const head = $gry(source[line - 1].substring(0, offset))
            const body = $und($col(source[line - 1].substring(offset, offset + length)))
            const tail = $gry(source[line - 1].substring(offset + length))

            emit(this._task, level, pfx2, $gry(`| ${head}${body}${tail}`))
          } else {
            emit(this._task, level, pfx2, $gry(`| ${source[line - 1]}`))
          }
        }
      }
    }

    /* Our totals */
    const eLabel = this._errors === 1 ? 'error' : 'errors'
    const wLabel = this._warnings === 1 ? 'warning' : 'warnings'
    const eNumber = this._errors ? $red(this._errors) : 'no'
    const wNumber = this._warnings ? $ylw(this._warnings) : 'no'

    emit(this._task, 0, '')
    emit(this._task, 0, 'Found', eNumber, eLabel, 'and', wNumber, wLabel)
    emit(this._task, 0, '')

    return this
  }

  fail(...args: any[]): never {
    emit(this._task, _levels.ERROR, ...args)
    throw buildFailed
  }
}


/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

const whiteSquare = '\u25a1'
const blackSquare = '\u25a0'

/** Emit either plain or color */
function emit(task: string, level: number, ...args: any[]): void {
  /* Strip any "buildFailed" argument (as it's already logged) */
  const params = args.filter((arg) => arg !== buildFailed)
  if (params.length === 0) return

  /* Log in colors or plain text */
  _color ? emitColor(task, level, params) : emitPlain(task, level, params)
}

/** Emit in full colors! */
function emitColor(task: string, level: number, args: any[]): void {
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
  if (level <= _levels.TRACE) {
    prefixes.push(` ${gry}${whiteSquare}${rst} `) // trace: gray open
  } else if (level <= _levels.DEBUG) {
    prefixes.push(` ${gry}${blackSquare}${rst} `) // debug: gray
  } else if (level <= _levels.INFO) {
    prefixes.push(` ${grn}${blackSquare}${rst} `) // info: green
  } else if (level <= _levels.NOTICE) {
    prefixes.push(` ${blu}${blackSquare}${rst} `) // notice: blue
  } else if (level <= _levels.WARN) {
    prefixes.push(` ${ylw}${blackSquare}${rst} `) // warning: yellow
  } else {
    prefixes.push(` ${red}${blackSquare}${rst} `) // error: red
  }

  /* The prefix (task name and level) */
  const prefix = prefixes.join('')

  /* Now for the normal logging of all our parameters */
  const breakLength = _breakLength - _taskLength - 3 // 3 chas: space square space
  const message = formatWithOptions({ ...logOptions, breakLength }, ...args)

  const prefixed = prefix ? message.replace(/^/gm, prefix) : message
  write(`${zap}${prefixed}\n`)
}

function emitPlain(task: string, level: number, args: any[]): void {
  const prefixes: string[] = []

  if (task) {
    const pad = ''.padStart(_taskLength - task.length, ' ')
    prefixes.push(`${pad}${task}`)
  } else {
    prefixes.push(''.padStart(_taskLength, ' '))
  }

  if (level <= 0) {
    prefixes.push(' \u2502        \u2502 ')
  } else if (level <= _levels.TRACE) {
    prefixes.push(' \u2502  trace \u2502 ')
  } else if (level <= _levels.DEBUG) {
    prefixes.push(' \u2502  debug \u2502 ')
  } else if (level <= _levels.INFO) {
    prefixes.push(' \u2502   info \u2502 ')
  } else if (level <= _levels.NOTICE) {
    prefixes.push(' \u2502 notice \u2502 ')
  } else if (level <= _levels.WARN) {
    prefixes.push(' \u2502   warn \u2502 ')
  } else {
    prefixes.push(' \u2502  error \u2502 ')
  }

  /* The prefix (task name and level) */
  const prefix = prefixes.join('')

  /* Now for the normal logging of all our parameters */
  const breakLength = 80 - _taskLength - 12 // 12 chars of the level above
  const message = formatWithOptions({ ...logOptions, breakLength }, ...args)

  const prefixed = prefix ? message.replace(/^/gm, prefix) : message
  write(`${prefixed}\n`)
}

function write(value: string): void {
  process.stderr.write(Buffer.from(value, 'utf-8'))
}
