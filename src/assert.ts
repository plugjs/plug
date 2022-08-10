/* ========================================================================== *
 * BUILD FAILURES                                                             *
 * ========================================================================== */

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
