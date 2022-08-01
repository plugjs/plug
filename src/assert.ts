import { log } from './log'

/* ========================================================================== *
 * BUILD FAILURES                                                             *
 * ========================================================================== */

/** Constant thrown by `Run` indicating a build failure already logged */
const buildFailed = Symbol.for('plugjs:build.failed')

/** Fail this `Run` giving a descriptive reason */
export function fail(reason: string, ...data: any[]): never
/** Fail this `Run` for the specified cause, with an optional reason */
export function fail(cause: unknown, reason?: string, ...args: any[]): never
// Overload!
export function fail(causeOrReason: unknown, ...args: any[]): never {
  /* We never have to log `buildFailed`, so treat it as undefined */
  if (causeOrReason === buildFailed) causeOrReason = undefined

  /* Nomalize our arguments, extracting cause and reason */
  const [ cause, reason ] =
    typeof causeOrReason === 'string' ?
      [ undefined, causeOrReason ] :
      [ causeOrReason, args.shift() as string | undefined ]

  /* Log our error if we have to */
  if (reason) {
    if (cause) args.push(cause)
    log.sep().error(reason, ...args).sep()
  } else if (cause) {
    log.sep().error('Error', cause).sep()
  }

  /* Failure handled, never log it again */
  throw buildFailed
}

export function assert(assertion: any, message: string): asserts assertion {
  if (! assertion) fail(message)
}
