/** Define a branded type for log levels */
export type Level<N extends number> = N & { __brand_log_level: never }

// Those are all our defined log levels: please note the absence of the ZERO
// as it's falsy and 0x1fffffffffffff is Number.MAX_SAFE_INTEGER as a constant

/** The `TRACE` log level */
export const TRACE = 10 as Level<10>
/** The `DEBUG` log level */
export const DEBUG = 20 as Level<20>
/** The `INFO` log level */
export const INFO = 30 as Level<30>
/** The `NOTICE` log level (our default) */
export const NOTICE = 40 as Level<40>
/** The `WARN` log level */
export const WARN = 50 as Level<50>
/** The `ERROR` log level */
export const ERROR = 60 as Level<60>
/** The `OFF` log level (no logs are emitted) */
export const OFF = 0x1fffffffffffff as Level<0x1fffffffffffff>

/**  All our known log levels */
export const logLevels = Object.freeze({ TRACE, DEBUG, INFO, NOTICE, WARN, ERROR, OFF })

/** The type of all our known log levels */
export type LogLevels = typeof logLevels

/** ID of each one of our log levels (upper case) */
export type LogLevelKey = keyof LogLevels

/** Canonical name of each one of our log levels (lower case) */
export type LogLevelName = Lowercase<LogLevelKey>

/** A type identifying all our log level numbers */
export type LogLevel = LogLevels[LogLevelKey]

/** The type identifying a recognized log level as a `string`. */
export type LogLevelString = LogLevelKey | LogLevelName

/**
 * Convert a `string` (a {@link LogLevelString}) into a {@link LogLevel}.
 *
 * If the level specified is not a {@link LogLevelString}, the {@link NOTICE}
 * level (our default) will be returned.
 */
export function getLevelNumber<L extends LogLevelString>(level: L): LogLevels[Uppercase<L>] {
  const _level = level.toUpperCase() as LogLevelKey
  return (_level in logLevels ? logLevels[_level] : NOTICE) as any
}

/**
 * Convert a `number` (a {@link LogLevel}) into a {@link LogLevelName}.
 *
 * If the level specified is not precisely a {@link LogLevel}, the
 * closer {@link LogLevelName} will be returned.
 */
export function getLevelName<L extends LogLevel>(level: L): LogLevelName {
  if (level <= TRACE) return 'trace'
  if (level <= DEBUG) return 'debug'
  if (level <= INFO) return 'info'
  if (level <= NOTICE) return 'notice'
  if (level <= WARN) return 'warn'
  if (level <= ERROR) return 'error'
  return 'off'
}
