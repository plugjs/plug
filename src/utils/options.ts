type StringArguments = [ string, ...string[] ]

export type ParsedOptions<Options> = { globs: StringArguments, options: Options }
export type ParsedOptionalOptions<Options> = { globs: StringArguments, options?: Options | undefined }
export type ParseOptions<Options> = StringArguments | [ ...StringArguments, Options ]

/** Parse an array of at least one string, followed by an optional `Options` argument. */
export function parseOptions<Options>(args: ParseOptions<Options>): ParsedOptionalOptions<Options>
/** Parse an array of at least one string, followed by an optional `Options` argument. */
export function parseOptions<Options>(args: ParseOptions<Options>, defaults?: undefined): ParsedOptionalOptions<Options>
/** Parse an array of at least one string, followed by an optional `Options` argument, ensuring some defaults are present. */
export function parseOptions<Options, Defaults extends Options>(args: ParseOptions<Options>, defaults: Defaults): ParsedOptions<Options & Defaults>
// overloaded implementation
export function parseOptions<Options, Defaults extends Options>(args: ParseOptions<Options>, defaults?: Defaults): ParsedOptions<Options | Defaults | undefined> {
  const clone: ParseOptions<Options> = [ ...args ]
  const last = clone.splice(-1)[0]

  const { globs, options } =
    typeof last === 'string' ? {
      globs: [ ...clone, last ] as StringArguments,
      options: defaults,
    } : defaults ? {
      globs: [ ...clone ] as StringArguments,
      options: { ...defaults, ...last },
    } : {
      globs: [ ...clone ] as StringArguments,
      options: last,
    }

  return { globs, options }
}
