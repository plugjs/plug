import type { Writable } from 'node:stream'
import type { InspectOptions } from 'node:util'

import { EventEmitter } from 'node:events'

/* ========================================================================== */

/** Our level numbers (internal) */
export const logLevels = Object.freeze({
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  NOTICE: 40,
  WARN: 50,
  ERROR: 60,
  OFF: 0x1fffffffffffff, // Number.MAX_SAFE_INTEGER as a constant
} as const)

/** A type identifying all our log levels */
export type LogLevel = keyof typeof logLevels

/** A type identifying all our log level numbers */
export type LogLevelNumber = typeof logLevels[LogLevel]

/** Options for our {@link Logger} instances */
export interface LogOptions extends InspectOptions {
  /** The current output. */
  output: Writable,
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
  /** Log level as a number from {@link logLevels} */
  readonly logLevel: LogLevelNumber

  /** Add an event listener for the specified event. */
  on(eventName: 'changed', listener: (logOptions: this) => void): this;
  /** Add an event listener for the specified event triggering only once. */
  once(eventName: 'changed', listener: (logOptions: this) => void): this;
  /** Remove an event listener for the specified event. */
  off(eventName: 'changed', listener: (logOptions: this) => void): this;

  /** Convert for serialization, optionally overriding the default task name. */
  fork(taskName?: string): Partial<LogOptions>
}

/* ========================================================================== *
 * INTERNAL STATE                                                             *
 * ========================================================================== */

class LogOptionsImpl extends EventEmitter implements LogOptions {
  private _output: Writable = process.stderr
  private _level: LogLevelNumber = logLevels.NOTICE
  private _colors = (<NodeJS.WriteStream> this._output).isTTY
  private _breakLength = (<NodeJS.WriteStream> this._output).columns || 80
  private _taskLength = 0
  private _defaultTaskName = ''

  constructor() {
    super()

    /* The `LOG_OPTIONS` variable is a JSON-serialized `LogOptions` object */
    Object.assign(this, JSON.parse(process.env.LOG_OPTIONS || '{}'))

    /* The `LOG_LEVEL` variable is one of our `debug`, `info`, ... */
    if (process.env.LOG_LEVEL) {
      this.level = process.env.LOG_LEVEL.toUpperCase() as LogLevel
    }

    /* If the `LOG_COLOR` variable is specified, it should be `true` or `false` */
    if (process.env.LOG_COLOR) {
      if (process.env.LOG_COLOR.toLowerCase() === 'true') this.colors = true
      if (process.env.LOG_COLOR.toLowerCase() === 'false') this.colors = false
      // Other values don't change the value of `options.colors`
    }
  }

  private _notifyListeners(): void {
    super.emit('changed', this)
  }

  fork(taskName?: string): Partial<LogOptions> {
    return {
      level: this.level,
      colors: this._colors,
      breakLength: this._breakLength,
      taskLength: this._taskLength,
      defaultTaskName: taskName || this._defaultTaskName,
    }
  }

  get output(): Writable {
    return this._output
  }

  set output(output: Writable) {
    this._output = output
    this._colors = !! (<NodeJS.WriteStream> output).isTTY
    this._breakLength = (<NodeJS.WriteStream> output).columns
    this._notifyListeners()
  }

  get level(): LogLevel {
    if (this._level <= logLevels.TRACE) return 'TRACE'
    if (this._level <= logLevels.DEBUG) return 'DEBUG'
    if (this._level <= logLevels.INFO) return 'INFO'
    if (this._level <= logLevels.NOTICE) return 'NOTICE'
    if (this._level <= logLevels.WARN) return 'WARN'
    if (this._level <= logLevels.ERROR) return 'ERROR'
    return 'OFF'
  }

  set level(level: LogLevel) {
    if (typeof level === 'number') {
      if (level <= logLevels.TRACE) this._level = logLevels.TRACE
      else if (level <= logLevels.DEBUG) this._level = logLevels.DEBUG
      else if (level <= logLevels.INFO) this._level = logLevels.INFO
      else if (level <= logLevels.NOTICE) this._level = logLevels.NOTICE
      else if (level <= logLevels.WARN) this._level = logLevels.WARN
      else if (level <= logLevels.ERROR) this._level = logLevels.ERROR
      else this._level = logLevels.OFF
    } else {
      this._level = level in logLevels ? logLevels[level] : logLevels.INFO
    }
    this._notifyListeners()
  }

  get logLevel(): LogLevelNumber {
    return this._level
  }

  get colors(): boolean {
    return this._colors
  }

  set colors(color: boolean) {
    this._colors = color
    this._notifyListeners()
  }

  get breakLength(): number {
    return this._breakLength
  }

  set breakLength(breakLength: number) {
    this._breakLength = breakLength
    this._notifyListeners()
  }

  get taskLength(): number {
    return this._taskLength
  }

  set taskLength(taskLength: number) {
    this._taskLength = taskLength
    this._notifyListeners()
  }

  get defaultTaskName(): string {
    return this._defaultTaskName
  }

  set defaultTaskName(defaultTaskName: string) {
    this._defaultTaskName = defaultTaskName
    this._notifyListeners()
  }
}

/** Shared instance of our {@link LogOptions}. */
export const logOptions: LogOptions = new LogOptionsImpl()
