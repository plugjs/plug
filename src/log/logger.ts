import { emitColor, emitPlain, LogEmitter } from './emit'
import { DEBUG, ERROR, INFO, LogLevel, NOTICE, TRACE, WARN } from './levels'
import { logOptions } from './options'

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
}

/** A {@link Logger} extends the basic {@link Log} adding some state. */
export interface Logger extends Log {
  /** The current level for logging. */
  level: LogLevel,

  /** Enter a sub-level of logging, increasing indent */
  enter(): this
  /** Enter a sub-level of logging, increasing indent */
  enter(evel: LogLevel, message: string): this
  /** Leave a sub-level of logging, decreasing indent */
  leave(): this
  /** Leave a sub-level of logging, decreasing indent */
  leave(level: LogLevel, message: string): this
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

/** Default implementation of the {@link Logger} interface. */
class LoggerImpl implements Logger {
  private readonly _stack: { level: LogLevel, message: string, indent: number }[] = []
  private _level = _level
  private _indent = 0

  constructor(
      private readonly _task: string,
      private readonly _emitter: LogEmitter,
  ) {}

  private _emit(level: LogLevel, args: [ any, ...any ]): this {
    if (this._level > level) return this

    // TODO: handle previously logged failures
    // const params = args.filter((arg) => arg !== buildFailed)
    // if (params.length === 0) return this

    if (this._stack.length) {
      for (const { message, ...options } of this._stack) {
        this._emitter({ ...options, taskName: this._task }, [ message ])
      }
      this._stack.splice(0)
    }

    this._emitter({ level, taskName: this._task, indent: this._indent }, args)
    return this
  }

  get level(): LogLevel {
    return this._level
  }

  set level(level: LogLevel) {
    this._level = level
  }

  trace(...args: [ any, ...any ]): this {
    return this._emit(TRACE, args)
  }

  debug(...args: [ any, ...any ]): this {
    return this._emit(DEBUG, args)
  }

  info(...args: [ any, ...any ]): this {
    return this._emit(INFO, args)
  }

  notice(...args: [ any, ...any ]): this {
    return this._emit(NOTICE, args)
  }

  warn(...args: [ any, ...any ]): this {
    return this._emit(WARN, args)
  }

  error(...args: [ any, ...any ]): this {
    return this._emit(ERROR, args)
  }

  enter(): this
  enter(level: LogLevel, message: string): this
  enter(...args: [] | [ level: LogLevel, message: string ]): this {
    if (args.length) {
      const [ level, message ] = args
      this._stack.push({ level, message, indent: this._indent })
    }
    this._indent ++
    return this
  }

  leave(): this
  leave(level: LogLevel, message: string): this
  leave(...args: [] | [ level: LogLevel, message: string ]): this {
    this._stack.pop()
    this._indent --

    if (this._indent < 0) this._indent = 0

    if (args.length) {
      const [ level, message ] = args
      this._emit(level, [ message ])
    }

    return this
  }
}
