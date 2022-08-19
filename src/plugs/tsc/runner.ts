import ts from 'typescript' // TypeScript does NOT support ESM modules

import { failure } from '../../assert.js'
import { Files } from '../../files.js'
import { $p, log } from '../../log.js'
import { AbsolutePath, isFile } from '../../paths.js'
import { Plug } from '../../pipe.js'
import { Run } from '../../run.js'
import { parseOptions, ParseOptions } from '../../utils/options.js'
import { TypeScriptHost } from './compiler.js'
import { getCompilerOptions } from './options.js'
import { updateReport } from './report.js'

/* ========================================================================== *
 * WORKER PLUG                                                                *
 * ========================================================================== */

export default class Tsc implements Plug<Files> {
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

  async pipe(files: Files, run: Run): Promise<Files> {
    const baseDir = run.resolve('.') // "this" directory, base of all relative paths
    const report = run.report('TypeScript Report') // report used throughout
    const overrides = { ...this._options } // clone our options

    /*
     * The "tsconfig" file is either specified, or (if existing) first checked
     * alongside the sources, otherwise checked in the current directory.
     */
    const sourcesConfig = isFile(files.directory, 'tsconfig.json')
    const tsconfig = this._tsconfig ? run.resolve(this._tsconfig) :
      sourcesConfig || isFile(run.resolve('tsconfig.json'))

    /* Root directory must always exist */
    let rootDir: AbsolutePath
    if (overrides.rootDir) {
      rootDir = overrides.rootDir = run.resolve(overrides.rootDir)
    } else {
      rootDir = overrides.rootDir = files.directory
    }

    /* Output directory _also_ must always exist */
    let outDir: AbsolutePath
    if (overrides.outDir) {
      outDir = overrides.outDir = run.resolve(overrides.outDir)
    } else {
      outDir = overrides.outDir = rootDir // default to the root directory
    }

    /* All other root paths */
    if (overrides.rootDirs) {
      overrides.rootDirs = overrides.rootDirs.map((dir) => run.resolve(dir))
    }

    /* The baseURL is resolved, as well */
    if (overrides.baseUrl) overrides.baseUrl = run.resolve(overrides.baseUrl)

    /* We can now get our compiler options, and check any and all overrides */
    const { errors, options } = await getCompilerOptions(
        tsconfig, // resolved tsconfig.json from constructor, might be undefined
        overrides, // overrides from constructor, might be an empty object
        run.buildFile, // the build file where the overrides were specified,
        baseDir) // base dir where to resolve overrides

    /* Update report and fail on errors */
    updateReport(report, errors, baseDir)
    if (report.errors) report.done(true)

    /* Prep for compilation */
    const paths = [ ...files.absolutePaths() ]
    for (const path of paths) log.trace(`Compiling "${$p(path)}"`)

    log.info('Compiling', paths.length, 'files')
    log.debug('Compliation options', options)

    /* Typescript host, create program and compile */
    const host = new TypeScriptHost(rootDir)
    const program = ts.createProgram(paths, options, host, undefined, errors)
    const diagnostics = ts.getPreEmitDiagnostics(program)

    /* Update report and fail on errors */
    updateReport(report, diagnostics, rootDir)
    if (report.errors) report.done(true)

    /* Write out all files asynchronously */
    const builder = run.files(outDir)
    const promises: Promise<void>[] = []
    const result = program.emit(undefined, (fileName, code) => {
      promises.push(builder.write(fileName, code).then((file) => {
        log.trace('Written', $p(file))
      }).catch((error) => {
        run.log.error('Error writing to', fileName, error)
        throw failure() // no more logs!
      }))
    })

    /* Await for all files to be written and check */
    const settlements = await Promise.allSettled(promises)
    const failures = settlements
        .reduce((failures, s) => failures + s.status === 'rejected' ? 1 : 0, 0)
    if (failures) throw failure() // already logged above

    /* Update report and fail on errors */
    updateReport(report, result.diagnostics, rootDir)
    if (report.errors) report.done(true)

    /* All done, build our files and return it */
    const outputs = builder.build()
    log.info('TSC produced', outputs.length, 'files into', $p(outputs.directory))
    return outputs
  }
}
