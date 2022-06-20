export type ParsedOptions<Options> = { params: string[], options: Options }
export type ParsedOptionalOptions<Options> = { params: string[], options?: Options | undefined }
export type ParseOptions<Options> = string[] | [ ...string[], Options ] | [ Options ]

/** Parse an array of at least one string, followed by an optional `Options` argument. */
export function parseOptions<Options>(args: ParseOptions<Options>): ParsedOptionalOptions<Options>
/** Parse an array of at least one string, followed by an optional `Options` argument. */
export function parseOptions<Options>(args: ParseOptions<Options>, defaults?: undefined): ParsedOptionalOptions<Options>
/** Parse an array of at least one string, followed by an optional `Options` argument, ensuring some defaults are present. */
export function parseOptions<Options, Defaults extends Options>(args: ParseOptions<Options>, defaults: Defaults): ParsedOptions<Options & Defaults>
// overloaded implementation
export function parseOptions<Options, Defaults extends Options>(args: ParseOptions<Options>, defaults?: Defaults): ParsedOptions<any> {
  const params: string[] = []
  const options: any = { ...defaults }

  for (const arg of args) {
    if (typeof arg === 'string') params.push(arg)
    else Object.assign(options, arg)
  }

  return { params, options }
}
