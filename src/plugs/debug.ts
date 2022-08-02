import type { Files } from '../files'
import type { Run } from '../run'

import { $gry, $p, $und, log } from '../log'
import { install, Plug } from '../pipe'

/** Writes some info about the current {@link Files} being passed around. */
export class Debug implements Plug {
  constructor() {}

  async pipe(files: Files, run: Run): Promise<Files> {
    log.info('Debugging', files.length, 'files')
    log.info('-        base dir:', $p(run.resolve('@')))
    log.info('-  build file dir:', $p(run.resolve('.')))
    log.info('-       files dir:', $p(files.directory))
    if (files.length) {
      const [ path, ...paths ] = files
      log.info('-  relative paths:', $und($gry(path)))
      for (const p of paths) log.info('-                :', $und($gry(p)))
    }
    return files
  }
}

/* ========================================================================== *
 * INSTALLATION                                                               *
 * ========================================================================== */

install('debug', Debug)

declare module '../pipe' {
  export interface Pipe {
    /** Writes some info about the current {@link Files} being passed around. */
    debug: PipeExtension<typeof Debug>
  }
}
