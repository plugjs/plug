import { Files } from '../files.js'
import { resolveRelativeChildPath } from '../paths.js'
import { install, Plug } from '../pipe.js'
import { Run } from '../run.js'
import { match, MatchOptions } from '../utils/match.js'
import { ParseOptions, parseOptions } from '../utils/options.js'

/** Options for filtering {@link Files}. */
export interface FilterOptions extends MatchOptions {
  /** The base directory for filtering, and relativising the resulting files. */
  directory?: string
}

/** Filter the current {@link Files} using globs. */
export class Filter implements Plug<Files> {
  private readonly _globs: readonly [ string, ...readonly string[] ]
  private readonly _options: FilterOptions

  constructor(glob: string, ...args: ParseOptions<FilterOptions>) {
    const { params, options } = parseOptions(args, {})
    this._globs = [ glob, ...params ]
    this._options = options
  }

  pipe(files: Files, run: Run): Files {
    const { directory, ...options } = this._options

    const builder = run.files(directory || files.directory)
    const matcher = match(this._globs, options)

    for (const file of files.absolutePaths()) {
      const relative = resolveRelativeChildPath(builder.directory, file)
      if (relative && matcher(relative)) builder.unchecked(relative)
    }

    const result = builder.build()
    const discarded = files.length - result.length
    run.log.debug('Filtered', result.length, 'files (discarded', discarded, 'files)')

    return result
  }
}

/* ========================================================================== *
 * INSTALLATION                                                               *
 * ========================================================================== */

install('filter', Filter)

declare module '../pipe.js' {
  export interface Pipe {
    /** Filter the current {@link Files} using globs. */
    filter: PipeExtension<typeof Filter>
  }
}
