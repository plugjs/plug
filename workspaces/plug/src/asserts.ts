/* ========================================================================== *
 * BUILD FAILURES                                                             *
 * ========================================================================== */

import { githubAnnotation } from './logging/github'

/** A symbol marking {@link BuildFailure} instances */
const buildFailure = Symbol.for('plugjs:plug:types:BuildFailure')

/** A {@link BuildFailure} represents an error _already logged_ in our build. */
export class BuildFailure extends Error {
  readonly errors?: readonly any[] | undefined

  /** Construct a {@link BuildFailure} */
  constructor(message?: string | undefined, errors: any[] = []) {
    super(message || '')

    // Annotate this build failure in GitHub
    if (message) {
      githubAnnotation({ type: 'error', title: 'Build Failure' }, message)
    }

    /* Basic error setup: stack and errors */
    Error.captureStackTrace(this, BuildFailure)
    if (errors.length) this.errors = Object.freeze([ ...errors ])
  }

  static fail(): BuildFailure {
    return new BuildFailure(undefined, [])
  }

  static withMessage(message: string): BuildFailure {
    return new BuildFailure(message, [])
  }

  static withErrors(errors: any[]): BuildFailure {
    return new BuildFailure(undefined, errors)
  }

  static [Symbol.hasInstance](instance: any): boolean {
    return instance && instance[buildFailure] === buildFailure
  }

  static {
    (this.prototype as any)[buildFailure] = buildFailure
    this.prototype.name = this.name
  }
}

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

/** Fail a build with a message */
export function fail(message: string): never {
  throw BuildFailure.withMessage(message)
}
