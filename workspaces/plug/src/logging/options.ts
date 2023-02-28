import { EventEmitter } from 'node:events'

import { getLevelNumber, NOTICE } from './levels'

import type { Writable } from 'node:stream'
import type { InspectOptions } from 'node:util'
import type { LogLevel, LogLevelString } from './levels'

/* ========================================================================== */

/** Options for our {@link Logger} instances */
export interface LogOptions {
  /** The current output. */
  output: Writable,
  /** The current level for logging. */
  level: LogLevel,
  /** Whether to log in colors or not. */
  colors: boolean,
  /** Whether to enable the tasks spinner or not. */
  spinner: boolean,
  /** Width of the current terminal (if any) or `80`. */
  lineLength: number,
  /** The maximum length of a task name (for pretty alignment). */
  taskLength: number,
  /** The number of spaces used for indenting. */
  indentSize: number,
  /** Whether to show sources in reports or not. */
  showSources: boolean,
  /** The task name to be used by default if a task is not contextualized. */
  defaultTaskName: string,
  /** The options used by NodeJS for object inspection. */
  readonly inspectOptions: InspectOptions,

  /** Set an inspect option in {@link LogOptions.inspectOptions}). */
  setInspectOption<K extends keyof InspectOptions>(key: K, value: InspectOptions[K]): void

  /** Add an event listener for the specified event. */
  on(eventName: 'changed', listener: (logOptions: this) => void): this;
  /** Add an event listener for the specified event triggering only once. */
  once(eventName: 'changed', listener: (logOptions: this) => void): this;
  /** Remove an event listener for the specified event. */
  off(eventName: 'changed', listener: (logOptions: this) => void): this;

  /** Return a record of environment variables for forking. */
  forkEnv(taskName?: string): Record<string, string>
}

/* ========================================================================== *
 * INTERNAL STATE                                                             *
 * ========================================================================== */

class LogOptionsImpl extends EventEmitter implements LogOptions {
  private _output: Writable = process.stderr
  private _level: LogLevel = NOTICE
  private _colors = (<NodeJS.WriteStream> this._output).isTTY
  private _colorsSet = false // have colors been set manually?
  private _spinner = true // by default, the spinner is enabled
  private _lineLength = (<NodeJS.WriteStream> this._output).columns || 80
  private _lineLengthSet = false // has line length been set manually?
  private _showSources = true // by default, always show source snippets
  private _inspectOptions: InspectOptions = {}
  private _defaultTaskName = ''
  private _taskLength = 0
  private _indentSize = 2

  constructor() {
    super()

    /* The `LOG_LEVEL` variable is one of our `debug`, `info`, ... */
    if (process.env.LOG_LEVEL) {
      this._level = getLevelNumber(process.env.LOG_LEVEL as LogLevelString)
    }

    /* If the `LOG_COLORS` variable is specified, it should be `true` or `false` */
    if (process.env.LOG_COLORS) {
      if (process.env.LOG_COLORS.toLowerCase() === 'true') this.colors = true
      if (process.env.LOG_COLORS.toLowerCase() === 'false') this.colors = false
      // Other values don't change the value of `options.colors`
    }

    /*
     * The `__LOG_OPTIONS` variable is a JSON-serialized `LogOptions` object
     * and it's processed _last_ as it's normally only created by fork below
     * and consumed by the `Exec` plug (which has no other way of communicating)
     */
    Object.assign(this, JSON.parse(process.env.__LOG_OPTIONS || '{}'))
  }

  private _notifyListeners(): void {
    super.emit('changed', this)
  }

  forkEnv(taskName?: string): Record<string, string> {
    return {
      __LOG_OPTIONS: JSON.stringify({
        level: this._level,
        colors: this._colors,
        lineLength: this._lineLength,
        taskLength: this._taskLength,
        defaultTaskName: taskName || this._defaultTaskName,
        spinner: false, // forked spinner is always false
      }),
    }
  }

  get output(): Writable {
    return this._output
  }

  set output(output: Writable) {
    this._output = output
    if (! this._colorsSet) this._colors = !! (<NodeJS.WriteStream> output).isTTY
    if (! this._lineLengthSet) this._lineLength = (<NodeJS.WriteStream> output).columns
    this._notifyListeners()
  }

  get level(): LogLevel {
    return this._level
  }

  set level(level: LogLevel) {
    this._level = level
    this._notifyListeners()
  }

  get colors(): boolean {
    return this._colors
  }

  set colors(color: boolean) {
    this._colors = color
    this._colorsSet = true
    this._notifyListeners()
  }

  get spinner(): boolean {
    return this._spinner
  }

  set spinner(spinner: boolean) {
    this._spinner = spinner
    this._notifyListeners()
  }

  get lineLength(): number {
    return this._lineLength
  }

  set lineLength(lineLength: number) {
    this._lineLength = lineLength
    this._lineLengthSet = true
    this._notifyListeners()
  }

  get taskLength(): number {
    return this._taskLength
  }

  set taskLength(taskLength: number) {
    this._taskLength = taskLength
    this._notifyListeners()
  }

  get indentSize(): number {
    return this._indentSize
  }

  set indentSize(indentSize: number) {
    this._indentSize = indentSize
    if (this._indentSize < 1) this._indentSize = 1
    this._notifyListeners()
  }

  get showSources(): boolean {
    return this._showSources
  }

  set showSources(showSources: boolean) {
    this._showSources = showSources
    this._notifyListeners()
  }

  get defaultTaskName(): string {
    return this._defaultTaskName
  }

  set defaultTaskName(defaultTaskName: string) {
    this._defaultTaskName = defaultTaskName
    this._notifyListeners()
  }

  get inspectOptions(): InspectOptions {
    return {
      colors: this._colors,
      breakLength: this._lineLength,
      ...this._inspectOptions,
    }
  }

  setInspectOption<K extends keyof InspectOptions>(key: K, value: InspectOptions[K]): void {
    this._inspectOptions[key] = value
    this._notifyListeners()
  }
}

/* Unique symbol to share `LogOptions` per process */
const optionsKey = Symbol.for('plugjs.plug.logging.logOptions')

/** Get the shared _per process_ instance of our {@link LogOptions}. */
export function getLogOptions(): LogOptions {
  let options: LogOptions = (<any> globalThis)[optionsKey]
  if (! options) {
    options = new LogOptionsImpl()
    ;(<any> globalThis)[optionsKey] = options
  }
  return options
}
