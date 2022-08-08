import { currentRun } from './async'
import { getLogger, Logger } from './log/logger'
import { setupSpinner } from './log/spinner'

export * from './log/colors'
export * from './log/constants'
export * from './log/logger'
export * from './log/options'
export * from './log/report'

/* ========================================================================== *
 * INITIALIZATION                                                             *
 * ========================================================================== */

/* Remember to setup the spinner */
setupSpinner()

/* ========================================================================== *
 * LOGGER                                                                     *
 * ========================================================================== */

/** The generic, shared `log` object. */
type SingletonLogger = {
  [ k in Exclude<keyof Logger, 'enter' | 'leave'>]: (...args: Parameters<Logger[k]>) => SingletonLogger
}

/** The generic, shared `log` function type. */
type Log = ((...args: [ any, ...any ]) => void) & SingletonLogger

/** Our logging function (defaulting to the `NOTICE` level) */
export const log: Log = ((): Log => {
  /* Return either the current run's log, or the default task's logger */
  const logger = (): Logger => (currentRun()?.log || getLogger())

  /* Create a Logger wrapping the current logger */
  const wrapper: SingletonLogger = {
    trace(...args: [ any, ...any ]): SingletonLogger {
      logger().trace(...args)
      return wrapper
    },

    debug(...args: [ any, ...any ]): SingletonLogger {
      logger().debug(...args)
      return wrapper
    },

    info(...args: [ any, ...any ]): SingletonLogger {
      logger().info(...args)
      return wrapper
    },

    notice(...args: [ any, ...any ]): SingletonLogger {
      logger().notice(...args)
      return wrapper
    },

    warn(...args: [ any, ...any ]): SingletonLogger {
      logger().warn(...args)
      return wrapper
    },

    error(...args: [ any, ...any ]): SingletonLogger {
      logger().error(...args)
      return wrapper
    },

    fail(...args: [ any, ...any ]): never {
      // Dunno why TS thinks that `logger().fail(... args)` can return
      const log: Logger = logger()
      log.fail(...args)
    },
  }

  /* Create a function that will default logging to "NOTICE" */
  const log = (...args: [ any, ...any ]): void => void wrapper.notice(...args)

  /* Return our function, with added Logger implementation */
  return Object.assign(log, wrapper)
})()
