/* ========================================================================== *
 * BUILD FAILURES                                                             *
 * ========================================================================== */

/** Asserts something as _truthy_ and fail the build if not */
export function assert(assertion: any, message: string): asserts assertion {
  if (! assertion) throw failure(message)
}

export function fail(message: string): never
export function fail(message: string): never
export function fail(message: string): never {
  throw failure(message)
}

export function failure(): Error
export function failure(message: string): Error
export function failure(message: string, cause: any): Error
export function failure(message?: string, cause?: any): Error {
  void message, cause
  return new Error()
}
