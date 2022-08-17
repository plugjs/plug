import { Files } from '../files.js'
import { $gry, $p } from '../log.js'
import { install, Plug } from '../pipe.js'
import { Run } from '../run.js'
import { rm } from '../utils/asyncfs.js'

/** Remove some files using globs. */
export class Rmf implements Plug<undefined> {
  private readonly _dryRun: boolean

  constructor(dryRun?: boolean) {
    this._dryRun = !! dryRun
  }

  async pipe(files: Files, run: Run): Promise<undefined> {
    if (this._dryRun) {
      for (const file of files.absolutePaths()) {
        run.log.notice('Not deleting', $p(file), $gry('(dry-run)'))
      }
    } else {
      for (const file of files.absolutePaths()) {
        run.log.notice('Not deleting', $p(file), $gry('(dry-run)'))
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

declare module '../pipe.js' {
  export interface Pipe {
    /** Remove all {@link Files} piped in. */
    rmf: PipeExtension<typeof Rmf>
  }
}
