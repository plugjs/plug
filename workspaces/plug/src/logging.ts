import { currentContext } from './async'
import { getLogger } from './logging/logger'
import { setupSpinner } from './logging/spinner'

import type { Logger, Log } from './logging/logger'

export * from './logging/colors'
export * from './logging/github'
export * from './logging/levels'
export * from './logging/logger'
export * from './logging/options'
export * from './logging/report'

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
  const logger = (): Logger => (currentContext()?.log || getLogger())

  /* Create a Logger wrapping the current logger */
  const wrapper: Log = {
    trace(...args: [ any, ...any ]): void {
      logger().trace(...args)
    },

    debug(...args: [ any, ...any ]): void {
      logger().debug(...args)
    },

    info(...args: [ any, ...any ]): void {
      logger().info(...args)
    },

    notice(...args: [ any, ...any ]): void {
      logger().notice(...args)
    },

    warn(...args: [ any, ...any ]): void {
      logger().warn(...args)
    },

    error(...args: [ any, ...any ]): void {
      logger().error(...args)
    },

    fail(...args: [ any, ...any ]): never {
      return logger().fail(...args)
    },
  }

  /* Create a function that will default logging to "NOTICE" */
  const log = (...args: [ any, ...any ]): void => void wrapper.notice(...args)

  /* Return our function, with added Logger implementation */
  return Object.assign(log, wrapper)
})()
