import { currentContext } from './async'
import { getLogger, Log } from './log/logger'
import { setupSpinner } from './log/spinner'

export * from './log/colors'
export * from './log/levels'
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

/** The generic, shared `log` function type. */
export type LogFunction = ((...args: [ any, ...any ]) => void) & Log

/** Our logging function (defaulting to the `NOTICE` level) */
export const log: LogFunction = ((): LogFunction => {
  /* Return either the current run's log, or the default task's logger */
  const logger = (): Log => (currentContext()?.log || getLogger())

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

    fail(...args: [ any, ...any ]): never {
      throw logger().fail(...args) // fail() returns never but ?!?!?!?!?
    },
  }

  /* Create a function that will default logging to "NOTICE" */
  const log = (...args: [ any, ...any ]): void => void wrapper.notice(...args)

  /* Return our function, with added Logger implementation */
  return Object.assign(log, wrapper)
})()
