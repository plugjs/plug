import { Files } from '../files'
import { $gry, $p, $und } from '../log'
import { install } from '../pipe'
import { Plug, RunContext } from '../types'

declare module '../pipe' {
  export interface Pipe {
    /** Log some info about the current {@link Files} being passed around. */
    debug(): Pipe
  }
}

/* ========================================================================== *
 * INSTALLATION / IMPLEMENTATION                                              *
 * ========================================================================== */

/** Writes some info about the current {@link Files} being passed around. */
install('debug', class Debug implements Plug<Files> {
  async pipe(files: Files, run: RunContext): Promise<Files> {
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
})
