/* ========================================================================== *
 * BUILD FAILURES                                                             *
 * ========================================================================== */

/** A symbol marking {@link BuildFailure} instances */
const buildFailure = Symbol.for('plugjs:buildFailure')

/** Check if the specified argument is a {@link BuildFailure} */
export function isBuildFailure(arg: any): arg is BuildFailure {
  return arg && arg[buildFailure] === buildFailure
}

/** A {@link BuildFailure} represents an error _already logged_ in our build. */
export class BuildFailure extends Error {
  readonly errors!: readonly any[]
  logged: boolean

  /** Construct a {@link BuildFailure} */
  private constructor(message: string | undefined, errors: any[]) {
    super(message || '')

    /* Filter out any previously logged build failure */
    errors = errors.filter((e) => ! (isBuildFailure(e) && e.logged))

    /* Basic error setup, stack and marker */
    Error.captureStackTrace(this, BuildFailure)
    Object.defineProperties(this, {
      'errors': { value: Object.freeze(errors) },
      [buildFailure]: { value: buildFailure },
    })

    /* Request logging only if we have a message or some errors */
    this.logged = ! (message || errors.length)
  }

  static fail(): BuildFailure {
    return new BuildFailure(undefined, [])
  }

  static withMessage(message: string): BuildFailure {
    return new BuildFailure(message || undefined, [])
  }

  static withErrors(errors: any[]): BuildFailure {
    return new BuildFailure(undefined, errors)
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
