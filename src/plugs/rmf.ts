import { Files } from '../files'
import { $gry, $p } from '../log'
import { install } from '../pipe'
import { Plug, RunContext } from '../types'
import { rm } from '../utils/asyncfs'

/** Remove some files using globs. */
export class Rmf implements Plug<undefined> {
  private readonly _dryRun: boolean

  constructor(dryRun?: boolean) {
    this._dryRun = !! dryRun
  }

  async pipe(files: Files, run: RunContext): Promise<undefined> {
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

    return undefined
  }
}

/* ========================================================================== *
 * INSTALLATION                                                               *
 * ========================================================================== */

install('rmf', Rmf)

declare module '../pipe' {
  export interface Pipe {
    /** Remove all {@link Files} piped in. */
    rmf: PipeExtension<typeof Rmf>
  }
}
