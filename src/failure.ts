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
