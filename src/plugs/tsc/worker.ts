import ts from 'typescript' // TypeScript does NOT support ESM modules

import type { Files } from '../../files'
import type { Plug } from '../../pipe'
import type { Run } from '../../run'

import { $p, log } from '../../log'
import { getCurrentWorkingDirectory, isFile } from '../../paths'
import { workerMain } from '../../worker'
import { TypeScriptHost } from './compiler'
import { getCompilerOptions } from './options'
import { updateReport } from './report'

export type TscWorkerType = typeof TscWorker

/* ========================================================================== *
 * WORKER PLUG                                                                *
 * ========================================================================== */

class TscWorker implements Plug<Files> {
  constructor(
      private readonly _tsconfig: string | undefined,
      private readonly _options: ts.CompilerOptions,
  ) {}

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

    const report = run.log.report('TypeScript Report')

    // Update report and fail on errors
    updateReport(report, errors, getCurrentWorkingDirectory())
    if (report.errors) report.emit(true).fail()

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
    if (report.errors) report.emit(true).fail()

    const builder = run.files(out)
    const promises: Promise<void>[] = []
    const result = program.emit(undefined, (fileName, code) => {
      promises.push(builder.write(fileName, code).then((file) => {
        log.trace('Written', $p(file))
      }))
    })

    // Update report and fail on errors
    updateReport(report, result.diagnostics, root)
    if (report.errors) report.emit(true).fail()

    // Await for all files to be written and check
    const settlements = await Promise.allSettled(promises)
    let failures = 0
    for (const settlement of settlements) {
      if (settlement.status === 'fulfilled') continue
      run.log.error('Error writing file', settlement.reason)
      failures ++
    }
    if (failures) run.log.fail('Error writing files')

    // All done, build our files and return it
    const outputs = builder.build()
    log.info('TSC produced', outputs.length, 'files into', $p(outputs.directory))
    return outputs
  }
}

/** Run worker! */
workerMain(TscWorker)
