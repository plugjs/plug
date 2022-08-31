import { Files } from '../files'
import { $gry, $p } from '../log'
import { install, PipeParameters } from '../pipe'
import { Plug, RunContext } from '../types'
import { rm } from '../utils/asyncfs'

declare module '../pipe' {
  export interface Pipe {
    /**
     * Remove all {@link Files} piped in.
     *
     * @param dryRun If `true` only log what would be removed (default `false`)
     */
    rmf(dryRun?: boolean): Call
  }
}

/** Remove some files using globs. */
install('rmf', class Rmf implements Plug<void> {
  private readonly _dryRun: boolean

  constructor(...args: PipeParameters<'rmf'>)
  constructor(dryRun?: boolean) {
    this._dryRun = !! dryRun
  }

  async pipe(files: Files, run: RunContext): Promise<void> {
    if (this._dryRun) {
      for (const file of files.absolutePaths()) {
        run.log.notice('Not removing file', $p(file), $gry('(dry-run)'))
      }
    } else {
      for (const file of files.absolutePaths()) {
        run.log.notice('Removing file', $p(file))
        await rm(file)
      }
    }
  }
})
