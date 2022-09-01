import { Files } from '../files'
import { $gry, $p, $und } from '../log'
import { install, Plug, Context } from '../pipe'

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
  async pipe(files: Files, context: Context): Promise<Files> {
    context.log.notice('Debugging', files.length, 'files')
    context.log.notice('-        base dir:', $p(context.resolve('@')))
    context.log.notice('-  build file dir:', $p(context.resolve('.')))
    context.log.notice('-       files dir:', $p(files.directory))
    if (files.length) {
      const [ path, ...paths ] = files
      context.log.notice('-  relative paths:', $und($gry(path)))
      for (const p of paths) context.log.notice('-                :', $und($gry(p)))
    }
    return files
  }
})
