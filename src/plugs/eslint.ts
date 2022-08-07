import type { Files } from '../files'
import type { Run } from '../run'
import type { ESLintWorkerType } from './eslint/worker'

import { requireResolve } from '../paths'
import { install, Plug } from '../pipe'
import { executeWorker } from '../worker'

/** Writes some info about the current {@link Files} being passed around. */
export class ESLint implements Plug<undefined> {
  constructor(directory?: string)
  constructor(private readonly _directory?: string) {}

  async pipe(files: Files, run: Run): Promise<undefined> {
    const script = requireResolve(__filename, './eslint/worker')
    return executeWorker<ESLintWorkerType>(script, files, run,
        this._directory,
    )
  }
}

/* ========================================================================== *
 * INSTALLATION                                                               *
 * ========================================================================== */

install('eslint', ESLint)

declare module '../pipe' {
  export interface Pipe {
    /** Writes some info about the current {@link Files} being passed around. */
    eslint: PipeExtension<typeof ESLint>
  }
}
