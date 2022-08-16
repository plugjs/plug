import { currentRun } from './async.js'
import { getLogger, Log } from './log/logger.js'
import { setupSpinner } from './log/spinner.js'

export * from './log/colors.js'
export * from './log/levels.js'
export * from './log/logger.js'
export * from './log/options.js'
export * from './log/report.js'

/* ========================================================================== *
 * INITIALIZATION                                                             *
 * ========================================================================== */

/* Remember to setup the spinner */
setupSpinner()

/* ========================================================================== *
 * LOGGER                                                                     *
 * ========================================================================== */

/** The generic, shared `log` function type. */
export type LogFunction = ((...args: [ any, ...any ]) => void) & Log

/** Our logging function (defaulting to the `NOTICE` level) */
export const log: LogFunction = ((): LogFunction => {
  /* Return either the current run's log, or the default task's logger */
  const logger = (): Log => (currentRun()?.log || getLogger())

  /* Create a Logger wrapping the current logger */
  const wrapper: Log = {
    trace(...args: [ any, ...any ]): Log {
      logger().trace(...args)
      return wrapper
    },

    debug(...args: [ any, ...any ]): Log {
      logger().debug(...args)
      return wrapper
    },

    info(...args: [ any, ...any ]): Log {
      logger().info(...args)
      return wrapper
    },

    notice(...args: [ any, ...any ]): Log {
      logger().notice(...args)
      return wrapper
    },

    warn(...args: [ any, ...any ]): Log {
      logger().warn(...args)
      return wrapper
    },

    error(...args: [ any, ...any ]): Log {
      logger().error(...args)
      return wrapper
    },
  }

  /* Create a function that will default logging to "NOTICE" */
  const log = (...args: [ any, ...any ]): void => void wrapper.notice(...args)

  /* Return our function, with added Logger implementation */
  return Object.assign(log, wrapper)
})()
