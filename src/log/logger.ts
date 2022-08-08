import { buildFailed } from './constants'
import { emit } from './emit'
import { logLevels, logOptions } from './options'

/* ========================================================================== */

/* Initial value of log colors, and subscribe to changes */
let _level = logOptions.logLevel
let _defaultTaskName = logOptions.defaultTaskName
logOptions.on('changed', ({ defaultTaskName, logLevel }) => {
  _defaultTaskName = defaultTaskName
  _level = logLevel
})

/* ========================================================================== *
 * LOGGER                                                                     *
 * ========================================================================== */

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

  enter: (...args: [ any, ...any ]) => this
  leave: (...args: [ any, ...any ]) => this
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
  private _indent = { indent: 0 }

  constructor(private readonly _task: string) {}

  trace(...args: [ any, ...any ]): this {
    if (_level > logLevels.TRACE) return this
    emit(this._task, logLevels.TRACE, this._indent, args)
    return this
  }

  debug(...args: [ any, ...any ]): this {
    if (_level > logLevels.DEBUG) return this
    emit(this._task, logLevels.DEBUG, this._indent, args)
    return this
  }

  info(...args: [ any, ...any ]): this {
    if (_level > logLevels.INFO) return this
    emit(this._task, logLevels.INFO, this._indent, args)
    return this
  }

  notice(...args: [ any, ...any ]): this {
    if (_level > logLevels.NOTICE) return this
    emit(this._task, logLevels.NOTICE, this._indent, args)
    return this
  }

  warn(...args: [ any, ...any ]): this {
    if (_level > logLevels.WARN) return this
    emit(this._task, logLevels.WARN, this._indent, args)
    return this
  }

  error(...args: [ any, ...any ]): this {
    if (_level > logLevels.ERROR) return this
    emit(this._task, logLevels.ERROR, this._indent, args)
    return this
  }

  fail(...args: [ any, ...any ]): never {
    if (args.includes(buildFailed)) throw buildFailed
    emit(this._task, logLevels.ERROR, this._indent, args)
    throw buildFailed
  }

  enter(...args: [ any, ...any ]): this {
    emit(this._task, logLevels.INFO, this._indent, args)
    this._indent.indent ++
    return this
  }

  leave(...args: [ any, ...any ]): this {
    this._indent.indent --
    if (this._indent.indent < 0) this._indent.indent = 0
    emit(this._task, logLevels.INFO, this._indent, args)
    return this
  }
}
