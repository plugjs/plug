import { readFile, writeFile } from '../fs'
import { install } from '../pipe'

import type { Files } from '../files'
import type { PipeParameters, Plug } from '../pipe'

declare module '../index' {
  export interface Pipe {
    /** Edits the content of all files in a pipeline. */
    edit(callback: (content: string) => string | void | Promise<string | void>): Pipe
  }
}

/* ========================================================================== *
 * INSTALLATION / IMPLEMENTATION                                              *
 * ========================================================================== */

/** Edits the content of all files in a pipeline. */
install('edit', class Edit implements Plug<Files> {
  private readonly _callback: (content: string) => string | void | Promise<string | void>

  constructor(...args: PipeParameters<'edit'>) {
    this._callback = args[0]
  }

  async pipe(files: Files): Promise<Files> {
    for (const file of files.absolutePaths()) {
      const data = await readFile(file, 'utf-8')
      const edited = await this._callback(data)
      if (edited !== undefined) await writeFile(file, edited, 'utf-8')
    }
    return files
  }
})
