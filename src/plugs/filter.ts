import { Files, getRelativeChildPath } from '../files'
import { ParseOptions, parseOptions } from '../utils/options'
import { MatchOptions, match } from '../utils/match'

import type { Plug } from '../pipe'
import type { Run } from '../run'

/**
 * The {@link FindOptions} interface defines the options available to
 * {@link TaskContext.find}.
 */
 export interface FilterOptions extends MatchOptions {
  /**
   * The directory where to start looking for files.
   *
   * @defaultValue The current {@link Run.directory}
   */
   directory?: string
}


export class Filter implements Plug {
  #globs: [ string, ...string[] ]
  #options: FilterOptions

  constructor(glob: string, ...args: ParseOptions<FilterOptions>) {
    const { params, options } = parseOptions(args, {})
    this.#globs = [ glob, ...params ]
    this.#options = options
  }

  pipe(run: Run, files: Files): Files {
    const { directory, ...options } = this.#options

    const builder = Files.builder(run, directory)
    const matcher = match(this.#globs, options)

    for (const file of files.absolutePaths()) {
      const relative = getRelativeChildPath(builder.directory, file)
      if (relative && matcher(relative)) builder.push(relative)
    }

    return builder.build()
  }
}
