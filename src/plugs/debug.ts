import type { Files } from '../files'
import type { Run } from '../run'

import { $p, log } from '../log'
import { install, Plug } from '../pipe'

/**
 * A simple {@link Plug} writing some debugging info about the {@link Files}
 * being passed around in our {@link Pipe}.
 */
export class Debug implements Plug {
  constructor() {}

  async pipe(files: Files, run: Run): Promise<Files> {
    log.info('Debugging', files.length, 'files')
    log.info('-        base dir:', $p(run.resolve('@')))
    log.info('-  build file dir:', $p(run.resolve('.')))
    log.info('-       files dir:', $p(files.directory))
    if (files.length) {
      const [ path, ...paths ] = [ ...files.absolutePaths() ]
      log.info('-           files:', $p(path))
      for (const p of paths) log.info('-                :', $p(p))
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
    /**
     * A simple {@link Plug} writing some debugging info about the {@link Files}
     * being passed around in our {@link Pipe}.
     */
    debug: PipeExtension<typeof Debug>
  }
}
