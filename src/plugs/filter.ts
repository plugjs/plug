import { Files } from '../files'
import { resolveRelativeChildPath } from '../paths'
import { install, PipeParameters } from '../pipe'
import { Plug, RunContext } from '../types'
import { match, MatchOptions } from '../utils/match'
import { ParseOptions, parseOptions } from '../utils/options'

/** Options for filtering {@link Files}. */
export interface FilterOptions extends MatchOptions {
  /** The base directory for filtering, and relativising the resulting files. */
  directory?: string
}

declare module '../pipe' {
  export interface Pipe {
    /**
     * Filter the current {@link Files} using globs.
     *
     * @param glob The glob to use for filtering files
     */
    filter(glob: string): Pipe
    /**
     * Filter the current {@link Files} using globs.
     *
     * @param globs The globs to use for filtering files (at least one)
     */
    filter(...globs: [ string, ...string[] ]): Pipe
    /**
     * Filter the current {@link Files} using globs.
     *
     * @param globs The globs to use for filtering files (at least one)
     * @param options Additional {@link FilterOptions | options} for filtering
     */
    filter(...args: [ ...globs: [ string, ...string[] ], options: FilterOptions ]): Pipe
  }
}

/* ========================================================================== *
 * INSTALLATION / IMPLEMENTATION                                              *
 * ========================================================================== */

/** Filter the current {@link Files} using globs. */
install('filter', class Filter implements Plug<Files> {
  private readonly _globs: readonly [ string, ...readonly string[] ]
  private readonly _options: FilterOptions

  constructor(...args: PipeParameters<'filter'>)
  constructor(glob: string, ...args: ParseOptions<FilterOptions>) {
    const { params, options } = parseOptions(args, {})
    this._globs = [ glob, ...params ]
    this._options = options
  }

  pipe(files: Files, run: RunContext): Files {
    const { directory, ...options } = this._options

    const dir = directory ? run.resolve(directory) : files.directory
    const builder = Files.builder(dir)
    const matcher = match(this._globs, options)

    for (const file of files.absolutePaths()) {
      const relative = resolveRelativeChildPath(builder.directory, file)
      if (relative && matcher(relative)) builder.add(relative)
    }

    const result = builder.build()
    const discarded = files.length - result.length
    run.log.debug('Filtered', result.length, 'files (discarded', discarded, 'files)')

    return result
  }
})
