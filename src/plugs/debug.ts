import { $gry, $p, $und, $ylw } from '../log'
import { install } from '../pipe'

import type { Files } from '../files'
import type { Context, PipeParameters, Plug } from '../pipe'

declare module '../pipe' {
  export interface Pipe {
    /** Log some info about the current {@link Files} being passed around. */
    debug(title?: string): Pipe
  }
}

/* ========================================================================== *
 * INSTALLATION / IMPLEMENTATION                                              *
 * ========================================================================== */

/** Writes some info about the current {@link Files} being passed around. */
install('debug', class Debug implements Plug<Files> {
  private readonly _title: string

  constructor(...args: PipeParameters<'debug'>) {
    const [ title = 'Debugging' ] = args
    this._title = title
  }

  async pipe(files: Files, context: Context): Promise<Files> {
    context.log.notice(this._title, `${$gry('(')}${$ylw(files.length)} ${$gry('files)')}`)
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
