import { currentContext } from './async'
import { $gry, $wht } from './logging/colors'
import { getLogger } from './logging/logger'
import { setupSpinner } from './logging/spinner'

import type { Log, Logger } from './logging/logger'

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

/* ========================================================================== *
 * BANNER                                                                     *
 * ========================================================================== */

/** Print a nice _banner_ message on the log */
export function banner(message: string): void {
  const padMessage = message.length > 60 ? message.length : 60
  const padLines = padMessage + 2

  log.notice([
    '',
    $gry(`\u2554${''.padStart(padLines, '\u2550')}\u2557`),
    `${$gry('\u2551')} ${$wht(message.padEnd(padMessage, ' '))} ${$gry('\u2551')}`,
    $gry(`\u255A${''.padStart(padLines, '\u2550')}\u255D`),
    '',
  ].join('\n'))
}
