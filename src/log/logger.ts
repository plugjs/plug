import { buildFailed } from './constants'
import { emit } from './emit'
import { logLevels, logOptions } from './options'

/* ========================================================================== */

/* Initial value of log colors, and subscribe to changes */
let _level = logOptions.logLevel
logOptions.on('changed', ({ logLevel }) => {
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
}

/** Return a {@link Logger} associated with the specified task name. */
export function getLogger(task: string = ''): Logger {
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
  constructor(private readonly _task: string) {}

  trace(...args: [ any, ...any ]): this {
    if (_level > logLevels.TRACE) return this
    emit(this._task, logLevels.TRACE, ...args)
    return this
  }

  debug(...args: [ any, ...any ]): this {
    if (_level > logLevels.DEBUG) return this
    emit(this._task, logLevels.DEBUG, ...args)
    return this
  }

  info(...args: [ any, ...any ]): this {
    if (_level > logLevels.INFO) return this
    emit(this._task, logLevels.INFO, ...args)
    return this
  }

  notice(...args: [ any, ...any ]): this {
    if (_level > logLevels.NOTICE) return this
    emit(this._task, logLevels.NOTICE, ...args)
    return this
  }

  warn(...args: [ any, ...any ]): this {
    if (_level > logLevels.WARN) return this
    emit(this._task, logLevels.WARN, ...args)
    return this
  }

  error(...args: [ any, ...any ]): this {
    if (_level > logLevels.ERROR) return this
    emit(this._task, logLevels.ERROR, ...args)
    return this
  }

  fail(...args: [ any, ...any ]): never {
    if (args.includes(buildFailed)) throw buildFailed
    emit(this._task, logLevels.ERROR, ...args)
    throw buildFailed
  }
}
