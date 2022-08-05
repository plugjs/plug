import type { Files } from '../files'
import type { Run } from '../run'

import { $gry, $p, $und, log } from '../log'
import { install, Plug } from '../pipe'

/** Writes some info about the current {@link Files} being passed around. */
export class Debug implements Plug<Files> {
  constructor() {}

  async pipe(files: Files, run: Run): Promise<Files> {
    log.notice('Debugging', files.length, 'files')
    log.notice('-        base dir:', $p(run.resolve('@')))
    log.notice('-  build file dir:', $p(run.resolve('.')))
    log.notice('-       files dir:', $p(files.directory))
    if (files.length) {
      const [ path, ...paths ] = files
      log.notice('-  relative paths:', $und($gry(path)))
      for (const p of paths) log.notice('-                :', $und($gry(p)))
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
