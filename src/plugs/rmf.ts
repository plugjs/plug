import { rm } from '../fs'
import { $gry, $p } from '../logging'
import { install } from '../pipe'

import type { Files } from '../files'
import type { Context, PipeParameters, Plug } from '../pipe'

declare module '../pipe' {
  export interface Pipe {
    /**
     * Remove all {@link Files} piped in.
     *
     * @param dryRun If `true` only log what would be removed (default `false`)
     */
    rmf(dryRun?: boolean): Promise<undefined>
  }
}

/** Remove some files using globs. */
install('rmf', class Rmf implements Plug<void> {
  private readonly _dryRun: boolean

  constructor(...args: PipeParameters<'rmf'>)
  constructor(dryRun?: boolean) {
    this._dryRun = !! dryRun
  }

  async pipe(files: Files, context: Context): Promise<void> {
    if (this._dryRun) {
      for (const file of files.absolutePaths()) {
        context.log.notice('Not removing file', $p(file), $gry('(dry-run)'))
      }
    } else {
      for (const file of files.absolutePaths()) {
        context.log.notice('Removing file', $p(file))
        await rm(file)
      }
    }
  }
})
