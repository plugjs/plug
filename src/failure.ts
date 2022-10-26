/** A symbol marking {@link BuildFailure} instances */
const buildFailure = Symbol.for('plugjs:buildFailure')

/** Check if the specified argument is a {@link BuildFailure} */
export function isBuildFailure(arg: any): arg is BuildFailure {
  return arg && arg[buildFailure] === buildFailure
}

/** A {@link BuildFailure} represents an error _already logged_ in our build. */
export class BuildFailure extends Error {
  readonly errors: readonly any[]
  logged: boolean

  /** Construct a {@link BuildFailure} that was already _logged_ (internal) */
  constructor(options: { logged: true })
  /** Construct a {@link BuildFailure} with a detail message */
  constructor(message: string, errors?: any[])
  // Constructor overload implementation
  constructor(options: string | { logged: boolean } = 'Build Failure', errors: any[] = []) {
    const { logged, message } =
      typeof options === 'string' ?
        { message: options, logged: false } :
        { message: 'Build Failure', ...options }

    super(message)
    Error.captureStackTrace(this, BuildFailure)
    Object.defineProperty(this, buildFailure, { value: buildFailure })
    this.errors = errors.filter((e) => ! (isBuildFailure(e) && e.logged))
    this.logged = logged
  }
}
