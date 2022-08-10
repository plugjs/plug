import { inspect } from 'node:util'

/* ========================================================================== *
 * BUILD FAILURES                                                             *
 * ========================================================================== */

const buildFailure = Symbol.for('plugjs:isBuild')

/** Check if the specified build is actually a {@link Build} */
export function isBuildFailure(arg: any): arg is BuildFailure {
  return arg && arg[buildFailure] === buildFailure
}

/** An error produced in our build, with proper inspection for logging */
export class BuildError extends Error {
  constructor(message: string) {
    super(message)
  }

  [inspect.custom](): string {
    return this.message
  }
}

/** A {@link BuildFailure} represents an error _already logged_ in our build. */
export class BuildFailure extends BuildError {
  constructor() {
    super('Build Failure')
    Object.defineProperty(this, buildFailure, { value: buildFailure })
  }
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
