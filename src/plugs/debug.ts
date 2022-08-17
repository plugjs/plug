import { Files } from '../files.js'
import { $gry, $p, $und } from '../log.js'
import { install, Plug } from '../pipe.js'
import { Run } from '../run.js'

/** Writes some info about the current {@link Files} being passed around. */
export class Debug implements Plug<Files> {
  constructor() {}

  async pipe(files: Files, run: Run): Promise<Files> {
    run.log.notice('Debugging', files.length, 'files')
    run.log.notice('-        base dir:', $p(run.resolve('@')))
    run.log.notice('-  build file dir:', $p(run.resolve('.')))
    run.log.notice('-       files dir:', $p(files.directory))
    if (files.length) {
      const [ path, ...paths ] = files
      run.log.notice('-  relative paths:', $und($gry(path)))
      for (const p of paths) run.log.notice('-                :', $und($gry(p)))
    }
    return files
  }
}

/* ========================================================================== *
 * INSTALLATION                                                               *
 * ========================================================================== */

install('debug', Debug)

declare module '../pipe.js' {
  export interface Pipe {
    /** Writes some info about the current {@link Files} being passed around. */
    debug: PipeExtension<typeof Debug>
  }
}
