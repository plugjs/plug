import { Files } from '../files'
import { log } from '../log'
import { match, MatchOptions } from '../utils/match'
import { ParseOptions, parseOptions } from '../utils/options'
import { resolveRelativeChildPath } from '../paths'
import { install, Plug } from '../pipe'
import { Run } from '../run'

/** Options for filtering {@link Files}. */
export interface FilterOptions extends MatchOptions {
  /** The base directory for filtering, and relativising the resulting files. */
  directory?: string
}

/** Filter the current {@link Files} using globs. */
export class Filter implements Plug {
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
      if (relative && matcher(relative)) builder.add(relative)
    }

    const result = builder.build()
    const discarded = files.length - result.length
    log.debug('Filtered', result.length, 'files (discarded', discarded, 'files)')

    return result
  }
}

/* ========================================================================== *
 * INSTALLATION                                                               *
 * ========================================================================== */

install('filter', Filter)

declare module '../pipe' {
  export interface Pipe {
    /** Filter the current {@link Files} using globs. */
    filter: PipeExtension<typeof Filter>
  }
}
