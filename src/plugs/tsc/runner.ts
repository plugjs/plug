import ts from 'typescript' // TypeScript does NOT support ESM modules

import { failure } from '../../assert.js'
import { Files } from '../../files.js'
import { $p, log } from '../../log.js'
import { getCurrentWorkingDirectory, isFile } from '../../paths.js'
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
    const tsconfig = this._tsconfig ?
      run.resolve(this._tsconfig) :
      isFile(files.directory, 'tsconfig.json')

    const overrides: ts.CompilerOptions = {
      rootDir: files.directory, // by default, our "files" directory
      ...this._options, // any other options specified in the constructor
    }

    const { errors, options } = await getCompilerOptions(
        tsconfig, // resolved tsconfig.json from constructor, might be undefined
        overrides, // overrides from constructor, might be an empty object
        run.buildFile) // overrides are defined in the build file, sooo.....

    const report = run.report('TypeScript Report')

    // Update report and fail on errors
    updateReport(report, errors, getCurrentWorkingDirectory())
    if (report.errors) report.done(true)

    const { rootDir, outDir } = options
    const root = rootDir ? run.resolve(rootDir) : files.directory
    const out = outDir ? run.resolve(outDir) : root

    const host = new TypeScriptHost(root)

    const paths = [ ...files.absolutePaths() ]
    for (const path of paths) log.trace(`Compiling "${$p(path)}"`)

    // Get our build file and create the master program
    log.info('Compiling', paths.length, 'files')
    log.debug('Compliation options', options)

    const program = ts.createProgram(paths, options, host, undefined, errors)
    const diagnostics = ts.getPreEmitDiagnostics(program)

    // Update report and fail on errors
    updateReport(report, diagnostics, root)
    if (report.errors) report.done(true)

    const builder = run.files(out)
    const promises: Promise<void>[] = []
    const result = program.emit(undefined, (fileName, code) => {
      promises.push(builder.write(fileName, code).then((file) => {
        log.trace('Written', $p(file))
      }).catch((error) => {
        run.log.error('Error writing to', fileName, error)
        throw failure() // no more logs!
      }))
    })

    // Update report and fail on errors
    updateReport(report, result.diagnostics, root)
    if (report.errors) report.done(true)

    // Await for all files to be written and check
    const settlements = await Promise.allSettled(promises)
    const failures = settlements
        .reduce((failures, s) => failures + s.status === 'rejected' ? 1 : 0, 0)
    if (failures) throw failure() // already logged above

    // All done, build our files and return it
    const outputs = builder.build()
    log.info('TSC produced', outputs.length, 'files into', $p(outputs.directory))
    return outputs
  }
}
