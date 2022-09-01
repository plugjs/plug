/** A type extacting string parameters from an arguments array */
export type ParsedParams<Args extends readonly any[]> =
  // Normal tuple, we stop processing if the _first_ argument is not a string!
  Args extends readonly [ infer First, ...infer Rest ] ?
    First extends string ? [ First, ...ParsedParams<Rest> ] : [] :

  // If not caught above, here "first" is the rest parameter in the tuple
  Args extends readonly [ ...infer First, infer Rest ] ?
    Rest extends string ? [ ...ParsedParams<First>, Rest ] : [ ...ParsedParams<First> ] :

  // Not a tuple: normal string array or the end of our arguments
  Args extends readonly string[] ? [ ...Args ] : []

/** A type extacting the (last) options type from an arguments array */
export type ParsedOptions<Args extends readonly any[]> = // , Defaults> =
  Args extends readonly [ ...string[], infer Last ] ?
    Last extends object ? // Record<any, any> ?
      Last : // last arg is a record, defaults is null or undefined
      never : // last arg is a string, defaults is null or undefined
  never // args is not an array

/** Parserable arguments: a number of strings, followed by optional options */
export type ParseOptions<Options extends Record<any, any>> =
  readonly [ ...params: string[] ] | readonly [ ...params: string[], options: Options ]

/** The return type from {@link ParseOptions} */
export interface ParsedResult<Args extends readonly any [], Options, Defaults> {
  params: ParsedParams<Args>,
  options: Defaults extends null | undefined ? Options | undefined : Options & Defaults
}

/**
 * Parse an array of arguments (a number of strings optionally followed by an
 * options object into parameters and options.
 */
export function parseOptions<
  Args extends ParseOptions<any>,
  Options extends ParsedOptions<Args> = ParsedOptions<Args>,
  Defaults extends ParsedOptions<Args> | null | undefined = undefined,
>(args: Args, defaults?: Defaults): ParsedResult<Args, Options, Defaults> {
  const params: string[] = []
  const clone: any[] = [ ...args ]

  // Collect all strings at the beginning of our arguments array
  while (typeof clone[0] === 'string') {
    params.push(clone.shift())
  }

  // The options is the _last_ element in our arguments array (if any)
  const options = Object.assign({}, defaults, clone.pop)

  // All done
  return { params, options } as ParsedResult<Args, Options, Defaults>
}
