import { AssertionError } from 'node:assert'
import { log } from './log'

/* ========================================================================== *
 * BUILD FAILURES                                                             *
 * ========================================================================== */

/** Constant thrown by `Run` indicating a build failure already logged */
const buildFailed = Symbol.for('plugjs:build.failed')

/** Fail a build, any argument specified will be passed to our {@link Logger} */
export function fail(...reason: any[]): never {
  /* If the reason contains "buildFailed", then we already logged this */
  for (const cause of reason) {
    if (cause === buildFailed) throw buildFailed
  }

  /* Log our error */
  log.sep().error(...reason).sep()

  /* Failure handled, never log it again */
  throw buildFailed
}

export function assert(assertion: any, message: string): asserts assertion {
  if (! assertion) fail(new AssertionError({ message, stackStartFn: assert }))
}
