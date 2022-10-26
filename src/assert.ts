/* ========================================================================== *
 * BUILD FAILURES                                                             *
 * ========================================================================== */

import { BuildFailure } from './failure'

/** Await and assert that all specified promises were fulfilled */
export async function assertPromises<T>(promises: (T | Promise<T>)[]): Promise<T[]> {
  // Await for the settlement of all the promises
  const settlements = await Promise.allSettled(promises)

  // Separate the good from the bad...
  const results: T[] = []
  const failures = new Set<any>()

  settlements.forEach((settlement) => {
    if (settlement.status === 'fulfilled') {
      results.push(settlement.value)
    } else {
      failures.add(settlement.reason)
    }
  })

  // Check for errors and report/fail if anything happened
  if (failures.size) throw BuildFailure.withErrors([ ...failures ])

  return results
}

/** Asserts something as _truthy_ and fail the build if not */
export function assert(assertion: any, message: string): asserts assertion {
  if (! assertion) throw BuildFailure.withMessage(message)
}
