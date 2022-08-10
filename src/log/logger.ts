import { buildFailed } from '../symbols'
import { emit } from './emit'
import { DEBUG, ERROR, INFO, LogLevel, NOTICE, TRACE, WARN } from './levels'
import { logOptions } from './options'

/* ========================================================================== */

/* Initial value of log colors, and subscribe to changes */
let _level = logOptions.level
let _defaultTaskName = logOptions.defaultTaskName
logOptions.on('changed', ({ defaultTaskName, level }) => {
  _defaultTaskName = defaultTaskName
  _level = level
})

/* ========================================================================== *
 * LOGGER                                                                     *
 * ========================================================================== */

/** The basic interface giving access to log facilities. */
export interface Log {
  /** Log a `TRACE` message */
  trace(...args: [ any, ...any ]): this
  /** Log a `DEBUG` message */
  debug(...args: [ any, ...any ]): this
  /** Log an `INFO` message */
  info(...args: [ any, ...any ]): this
  /** Log a `NOTICE` message */
  notice(...args: [ any, ...any ]): this
  /** Log a `WARNING` message */
  warn(...args: [ any, ...any ]): this
  /** Log an `ERROR` message */
  error(...args: [ any, ...any ]): this
  /** Log a `FAIL` message and throw */
  fail(...args: [ any, ...any ]): never
}

/** A {@link Logger} extends the basic {@link Log} adding some state. */
export interface Logger extends Log {
  /** Enter a sub-level of logging, increasing indent */
  enter(level: LogLevel, message: string): this

  /** Leave a sub-level of logging, decreasing indent */
  leave(): this
  /** Leave a sub-level of logging, decreasing indent */
  leave(level: LogLevel, message: string): this
}

/** Return a {@link Logger} associated with the specified task name. */
export function getLogger(task: string = _defaultTaskName): Logger {
  let logger = _loggers.get(task)
  if (! logger) {
    logger = new LoggerImpl(task)
    _loggers.set(task, logger)
  }
  return logger
}

/* ========================================================================== */

/** Cache of loggers by task-name. */
const _loggers = new Map<string, Logger>()

/** Default implementation of the {@link Logger} interface. */
class LoggerImpl implements Logger {
  private _indent = 0
  private _stack: { level: LogLevel, message: string, indent: number }[] = []

  constructor(private readonly _task: string) {}

  private _emitStack(): void {
    for (const { message, ...options } of this._stack) {
      emit({ ...options, taskName: this._task }, [ message ])
    }
    this._stack.splice(0)
  }

  trace(...args: [ any, ...any ]): this {
    if (_level > TRACE) return this
    this._emitStack()
    emit({ taskName: this._task, level: TRACE, indent: this._indent }, args)
    return this
  }

  debug(...args: [ any, ...any ]): this {
    if (_level > DEBUG) return this
    this._emitStack()
    emit({ taskName: this._task, level: DEBUG, indent: this._indent }, args)
    return this
  }

  info(...args: [ any, ...any ]): this {
    if (_level > INFO) return this
    this._emitStack()
    emit({ taskName: this._task, level: INFO, indent: this._indent }, args)
    return this
  }

  notice(...args: [ any, ...any ]): this {
    if (_level > NOTICE) return this
    this._emitStack()
    emit({ taskName: this._task, level: NOTICE, indent: this._indent }, args)
    return this
  }

  warn(...args: [ any, ...any ]): this {
    if (_level > WARN) return this
    this._emitStack()
    emit({ taskName: this._task, level: WARN, indent: this._indent }, args)
    return this
  }

  error(...args: [ any, ...any ]): this {
    if (_level > ERROR) return this
    this._emitStack()
    emit({ taskName: this._task, level: ERROR, indent: this._indent }, args)
    return this
  }

  fail(...args: [ any, ...any ]): never {
    if (args.includes(buildFailed)) throw buildFailed
    this._emitStack()
    emit({ taskName: this._task, level: ERROR, indent: this._indent }, args)
    throw buildFailed
  }

  enter(level: LogLevel, message: string): this {
    this._stack.push({ level, message, indent: this._indent })
    this._indent ++
    return this
  }

  leave(): this
  leave(level: LogLevel, message: string): this
  leave(level?: LogLevel, message?: string): this {
    this._stack.pop()
    this._emitStack()

    this._indent --
    if (this._indent < 0) this._indent = 0
    if (level && message) {
      emit({ taskName: this._task, level, indent: this._indent }, [ message ])
    }
    return this
  }
}
