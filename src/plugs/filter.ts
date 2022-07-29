import { Files } from '../files'
import { log } from '../log'
import { match, MatchOptions } from '../utils/match'
import { ParseOptions, parseOptions } from '../utils/options'
import { resolveRelativeChildPath } from '../paths'
import { Plug } from '../pipe'
import { Run } from '../run'

 export interface FilterOptions extends MatchOptions {
  /**
   * The directory where to start looking for files.
   *
   * @defaultValue The current {@link Run.directory}
   */
   directory?: string
}

/** Filter some {@link Files} based on some globs and optional directory. */
export class Filter implements Plug {
  #globs: [ string, ...string[] ]
  #options: FilterOptions

  constructor(glob: string, ...args: ParseOptions<FilterOptions>) {
    const { params, options } = parseOptions(args, {})
    this.#globs = [ glob, ...params ]
    this.#options = options
  }

  pipe(files: Files, run: Run): Files {
    const { directory, ...options } = this.#options

    const builder = run.files(directory || '@.')
    const matcher = match(this.#globs, options)

    for (const file of files.absolutePaths()) {
      const relative = resolveRelativeChildPath(builder.directory, file)
      if (relative && matcher(relative)) builder.add(relative)
    }

    const result = builder.build()
    log.debug('Filtered', result.length, 'files (discarded', files.length - result.length,'files)', {
      from: files.directory,
      into: result.directory,
      globs: this.#globs, options,
    })

    return result
  }
}

/** Filter some {@link Files} based on some globs and optional directory. */
export function filter(glob: string, ...args: ParseOptions<FilterOptions>): Filter {
  return new Filter(glob, ...args)
}
