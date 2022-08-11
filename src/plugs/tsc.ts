import ts from 'typescript' // TypeScript does NOT support ESM modules

import type { Files } from '../files'
import type { Run } from '../run'
import type { TscWorkerType } from './tsc/worker'

import { install, Plug } from '../pipe'
import { ParseOptions, parseOptions } from '../utils/options'
import { requireResolve } from '../paths'
import { executeWorker } from '../worker'

export class Tsc implements Plug<Files> {
  private readonly _tsconfig?: string
  private readonly _options: ts.CompilerOptions

  constructor()
  constructor(config: string)
  constructor(options: ts.CompilerOptions)
  constructor(config: string, options: ts.CompilerOptions)

  constructor(...args: ParseOptions<ts.CompilerOptions>) {
    const { params: [ tsconfig ], options } = parseOptions(args, {})
    this._tsconfig = tsconfig
    this._options = options
  }

  pipe(files: Files, run: Run): Promise<Files> {
    const script = requireResolve(__fileurl, './tsc/worker')
    return executeWorker<TscWorkerType>(script, files, run,
        this._tsconfig,
        this._options,
    )
  }
}

/* ========================================================================== *
 * INSTALLATION                                                               *
 * ========================================================================== */

install('tsc', Tsc)

declare module '../pipe' {
  export interface Pipe {
    tsc: PipeExtension<typeof Tsc>
  }
}
