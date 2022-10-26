/* ========================================================================== *
 * BUILD FAILURES                                                             *
 * ========================================================================== */

// import { currentContext } from './async'
// import { log } from './log'

const buildError = Symbol.for('plugjs:buildError')
const buildFailure = Symbol.for('plugjs:buildFailure')

/** Check if the specified argument is a {@link BuildError} */
export function isBuildError(arg: any): arg is BuildError {
  return arg && arg[buildError] === buildError
}

/** Check if the specified argument is a {@link BuildFailure} */
export function isBuildFailure(arg: any): arg is BuildFailure {
  return arg && arg[buildFailure] === buildFailure
}

/** An error produced in our build, with proper inspection for logging */
export class BuildError extends Error {
  constructor(message: string) {
    super(message)
    Object.defineProperty(this, buildError, { value: buildError })
  }
}

/** A {@link BuildFailure} represents an error _already logged_ in our build. */
export class BuildFailure extends Error {
  constructor() {
    super('Build Failure')
    Object.defineProperty(this, buildFailure, { value: buildFailure })
  }
}

/** Await and assert that all specified promises were fulfilled */
export async function assertPromises<T>(promises: (T | Promise<T>)[], message: string): Promise<T[]> {
  // Await for the settlement of all the promises
  const settlements = await Promise.allSettled(promises)

  // Separate the good from the bad... Here we don't report BuildFailures,
  // but we keep track of them, henceforth we keep track of both "hasFailed"
  // as a flag and "failures" as a set of what needs to be logged
  const results: T[] = []
  const failures = new Set<any>()
  let hasFailed = false

  settlements.forEach((settlement) => {
    if (settlement.status === 'fulfilled') {
      results.push(settlement.value)
    } else {
      hasFailed = true // mark failures
      const failure = settlement.reason
      if (! isBuildFailure(failure)) failures.add(failure)
    }
  })

  // Check for errors and report/fail if anything happened
  if (hasFailed) {
    console.log(message) // TODO
    // const context = currentContext()
    // const logger = context ? context.log : log
    // failures.forEach((failure) => {
    //   logger.error(message, failure)
    // })
    throw failure()
  }

  return results
}

/** Asserts something as _truthy_ and fail the build if not */
export function assert(assertion: any, message: string): asserts assertion {
  if (! assertion) throw new BuildError(message)
}

/** Throw a {@link BuildError} (an {@link Error} printed nicely) */
export function fail(message: string): never {
  throw new BuildError(message)
}

/** Return a non-logged {@link BuildFailure} */
export function failure(): BuildFailure {
  return new BuildFailure()
}
