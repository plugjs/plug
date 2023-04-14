import { BuildFailure, isBuildFailure } from '../asserts'
import { emitColor, emitPlain } from './emit'
import { DEBUG, ERROR, INFO, NOTICE, TRACE, WARN } from './levels'
import { logOptions } from './options'
import { ReportImpl } from './report'

import type { LogEmitter, LogEmitterOptions } from './emit'
import type { LogLevel } from './levels'
import type { Report } from './report'


/* ========================================================================== */

/* Initial value of log colors, and subscribe to changes */
let _level = logOptions.level
let _colors = logOptions.colors
let _defaultTaskName = logOptions.defaultTaskName
logOptions.on('changed', ({ defaultTaskName, colors, level }) => {
  _defaultTaskName = defaultTaskName
  _colors = colors
  _level = level
})

/* ========================================================================== *
 * LOGGER                                                                     *
 * ========================================================================== */

/** The basic interface giving access to log facilities. */
export interface Log {
  /** Log a `TRACE` message */
  trace(...args: [ any, ...any ]): void
  /** Log a `DEBUG` message */
  debug(...args: [ any, ...any ]): void
  /** Log an `INFO` message */
  info(...args: [ any, ...any ]): void
  /** Log a `NOTICE` message */
  notice(...args: [ any, ...any ]): void
  /** Log a `WARNING` message */
  warn(...args: [ any, ...any ]): void
  /** Log an `ERROR` message */
  error(...args: [ any, ...any ]): void
  /** Log an `ERROR` message and fail the build */
  fail(...args: [ any, ...any ]): never
}

/** A {@link Logger} extends the basic {@link Log} adding some state. */
export interface Logger extends Log {
  /** The current level for logging. */
  level: LogLevel,

  /** Enter a sub-level of logging, increasing indent */
  enter(): void
  /** Enter a sub-level of logging, increasing indent */
  enter(evel: LogLevel, message: string): void
  /** Leave a sub-level of logging, decreasing indent */
  leave(): void
  /** Leave a sub-level of logging, decreasing indent */
  leave(level: LogLevel, message: string): void
  /** Create a {@link Report} associated with this instance */
  report(title: string): Report
}

/** Return a {@link Logger} associated with the specified task name. */
export function getLogger(task: string = _defaultTaskName): Logger {
  let logger = _loggers.get(task)
  if (! logger) {
    const emitter = _colors ? emitColor : emitPlain
    logger = new LoggerImpl(task, emitter)
    _loggers.set(task, logger)
  }
  return logger
}

/* ========================================================================== */

/** Cache of loggers by task-name. */
const _loggers = new Map<string, Logger>()
/** Weak set of already logged build failures */
const _loggedFailures = new WeakSet<BuildFailure>()

/** Default implementation of the {@link Logger} interface. */
class LoggerImpl implements Logger {
  private readonly _stack: { level: LogLevel, message: string, indent: number }[] = []
  private _level = _level
  private _indent = 0

  constructor(
      private readonly _task: string,
      private readonly _emitter: LogEmitter,
  ) {}

  private _emit(level: LogLevel, args: [ any, ...any ]): void {
    if (this._level > level) return

    // The `BuildFailure` is a bit special case
    const params = args.filter((arg) => {
      if (isBuildFailure(arg)) {
        // Filter out any previously logged build failure and mark
        if (_loggedFailures.has(arg)) return false
        _loggedFailures.add(arg)

        // If the build failure has any root cause, log those
        arg.errors?.forEach((error) => this._emit(level, [ error ]))

        // Log this only if it has a message
        if (! arg.message) return false

        // Log the full error (with stack) if the _default_ level is DEBUG
        if (_level < INFO) return true

        // Log only the message in other cases
        this._emit(level, [ arg.message ])
        return false
      } else {
        return true
      }
    })

    // If there's nothing left to log, then we're done
    if (params.length === 0) return

    // Prepare our options for logging
    const options = { level, taskName: this._task, indent: this._indent }

    // Dump any existing stack entry
    if (this._stack.length) {
      for (const { message, ...extras } of this._stack) {
        this._emitter({ ...options, ...extras }, [ message ])
      }
      this._stack.splice(0)
    }

    // Emit our log lines and return
    this._emitter(options, params)
  }

  get level(): LogLevel {
    return this._level
  }

  set level(level: LogLevel) {
    this._level = level
  }

  trace(...args: [ any, ...any ]): void {
    this._emit(TRACE, args)
  }

  debug(...args: [ any, ...any ]): void {
    this._emit(DEBUG, args)
  }

  info(...args: [ any, ...any ]): void {
    this._emit(INFO, args)
  }

  notice(...args: [ any, ...any ]): void {
    this._emit(NOTICE, args)
  }

  warn(...args: [ any, ...any ]): void {
    this._emit(WARN, args)
  }

  error(...args: [ any, ...any ]): void {
    this._emit(ERROR, args)
  }

  fail(...args: [ any, ...any ]): never {
    this._emit(ERROR, args)
    throw BuildFailure.fail()
  }

  enter(): void
  enter(level: LogLevel, message: string): void
  enter(...args: [] | [ level: LogLevel, message: string ]): void {
    if (args.length) {
      const [ level, message ] = args
      this._stack.push({ level, message, indent: this._indent })
    }

    this._indent ++
  }

  leave(): void
  leave(level: LogLevel, message: string): void
  leave(...args: [] | [ level: LogLevel, message: string ]): void {
    this._stack.pop()
    this._indent --

    if (this._indent < 0) this._indent = 0

    if (args.length) {
      const [ level, message ] = args
      this._emit(level, [ message ])
    }
  }

  report(title: string): Report {
    const emitter: LogEmitter = (options: LogEmitterOptions, args: any) => {
      const indent = (this._indent ? this._indent + 1 : 0) + (options.indent || 0)
      this._emitter({ ...options, indent }, args)
    }
    return new ReportImpl(title, this._task, emitter)
  }
}
