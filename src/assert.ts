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

export function assert(assertion: any, message: string, ...args: any[]): asserts assertion {
  if (! assertion) fail(message, ...args)
}

/* ========================================================================== */

type PromiseSettlementAssertion<T extends any[]> = {
  [ K in keyof T ]:
    T[K] extends PromiseSettledResult<infer R> ?
      PromiseFulfilledResult<R> :
      never
}

/** Asserts that all promise settlements are actually fullfilled. */
export function assertSettled<T extends PromiseSettledResult<any>[]>(
    settlements: T, message: string, ...args: any[]
): asserts settlements is T & PromiseSettlementAssertion<T> {
  let errors = 0
  for (const settlement of settlements) {
    if (settlement.status === 'fulfilled') continue

    errors ++

    if (settlement.reason === buildFailed) continue
    log.sep().error(settlement.reason)
  }

  if (errors) fail(message, ...args)
}
