// import type { Files } from '../files'
// import type { Run } from '../run'
// import type { ESLintWorkerType } from './eslint/worker'

// import { assert } from '../assert'
// import { $p } from '../log'
// import { getCurrentWorkingDirectory, isDirectory, isFile, requireResolve } from '../paths'
// import { install, Plug } from '../pipe'
// import { executeWorker } from '../worker'

// export interface ESLintOptions {
//   /** ESLint's own _current working directory_, where config files are. */
//   directory?: string
//   /** Show sources in report? */
//   showSources?: boolean
//   /**
//    * ESLint's _override_ configuration file: configurations specified in this
//    * file will override any other configuration specified elsewhere.
//    */
//   configFile?: string
// }

// /** Writes some info about the current {@link Files} being passed around. */
// export class ESLint implements Plug<undefined> {
//   private readonly _options: Readonly<ESLintOptions>

//   constructor()
//   constructor(configFile: string)
//   constructor(options: ESLintOptions)
//   constructor(arg: string | ESLintOptions = {}) {
//     this._options = typeof arg === 'string' ? { configFile: arg } : arg
//   }

//   async pipe(files: Files, run: Run): Promise<undefined> {
//     const { directory, configFile } = this._options

//     const dir = directory ? run.resolve(directory) : getCurrentWorkingDirectory()
//     assert(isDirectory(dir), `ESLint directory ${$p(dir)} does not exist`)

//     const cfg = configFile ? run.resolve(configFile) : undefined
//     if (cfg) assert(isFile(cfg), `ESLint configuration ${$p(cfg)} does not exist`)

//     const script = requireResolve(__fileurl, './eslint/worker')
//     return executeWorker<ESLintWorkerType>(script, files, run, dir, cfg, this._options.showSources)
//   }
// }

// /* ========================================================================== *
//  * INSTALLATION                                                               *
//  * ========================================================================== */

// install('eslint', ESLint)

// declare module '../pipe' {
//   export interface Pipe {
//     /** Writes some info about the current {@link Files} being passed around. */
//     eslint: PipeExtension<typeof ESLint>
//   }
// }
