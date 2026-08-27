import { $gry, $und, $ylw } from '../logging.ts'
import { install } from '../pipe.ts'

import type { Files } from '../files.ts'
import type { Context, PipeParameters, Plug } from '../pipe.ts'

declare module '../index.ts' {
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
    context.log.notice('- build file dir:', $gry($und(context.resolve('@'))))
    context.log.notice('-    current dir:', $gry($und(context.resolve('.'))))
    context.log.notice('-      files dir:', $gry($und(files.directory)))

    const paths = [ ...files ]
    const path = paths.shift()
    context.log.notice('- relative paths:', $und($gry(path)))
    paths.forEach((p) => context.log.notice('-               :', $und($gry(p))))

    return files
  }
})
