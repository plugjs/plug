import { log } from './log'

/* ========================================================================== *
 * BUILD FAILURES                                                             *
 * ========================================================================== */

/** Asserts something as _truthy_ and fail the build if not */
export function assert(
    assertion: any,
    message: string = 'Assertion failed',
    ...args: any[]
): asserts assertion {
  if (! assertion) log.fail(message, ...args)
}
