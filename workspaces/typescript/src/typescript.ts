// Reference ourselves, so that the constructor's parameters are correct
/// <reference path="./index.ts"/>

import ts from 'typescript' // TypeScript does NOT support ESM modules
import { assertPromises, BuildFailure } from '@plugjs/plug/asserts'
import { Files } from '@plugjs/plug/files'
import { $p } from '@plugjs/plug/logging'
import { resolveAbsolutePath, resolveFile } from '@plugjs/plug/paths'
import { parseOptions, walk } from '@plugjs/plug/utils'

import { TypeScriptHost } from './compiler'
import { getCompilerOptions } from './options'
import { updateReport } from './report'

import type { AbsolutePath } from '@plugjs/plug/paths'
import type { Context, PipeParameters, Plug } from '@plugjs/plug/pipe'
import type { ExtendedCompilerOptions } from './index'


/* ========================================================================== *
 * WORKER PLUG                                                                *
 * ========================================================================== */

export class Tsc implements Plug<Files> {
  private readonly _tsconfig?: string
  private readonly _options: ExtendedCompilerOptions

  constructor(...args: PipeParameters<'tsc'>) {
    const { params: [ tsconfig ], options } = parseOptions(args, {})
    this._tsconfig = tsconfig
    this._options = options
  }

  async pipe(files: Files, context: Context): Promise<Files> {
    const baseDir = context.resolve('.') // "this" directory, base of all relative paths
    const report = context.log.report('TypeScript Report') // report used throughout
    const { extraTypesDir, ...overrides } = { ...this._options } // clone our options

    /*
     * The "tsconfig" file is either specified, or (if existing) first checked
     * alongside the sources, otherwise checked in the current directory.
     */
    const sourcesConfig = resolveFile(files.directory, 'tsconfig.json')
    const tsconfig = this._tsconfig ? context.resolve(this._tsconfig) :
      sourcesConfig || resolveFile(context.resolve('tsconfig.json'))

    /* Root directory must always exist */
    let rootDir: AbsolutePath
    if (overrides.rootDir) {
      rootDir = overrides.rootDir = context.resolve(overrides.rootDir)
    } else {
      rootDir = overrides.rootDir = files.directory
    }

    /* Output directory _also_ must always exist */
    let outDir: AbsolutePath
    if (overrides.outDir) {
      outDir = overrides.outDir = context.resolve(overrides.outDir)
    } else {
      outDir = overrides.outDir = rootDir // default to the root directory
    }

    /* All other root paths */
    if (overrides.rootDirs) {
      overrides.rootDirs = overrides.rootDirs.map((dir) => context.resolve(dir))
    }

    /* The baseURL is resolved, as well */
    if (overrides.baseUrl) overrides.baseUrl = context.resolve(overrides.baseUrl)

    /* The baseURL is resolved, as well */
    if (overrides.outFile) overrides.outFile = context.resolve(overrides.outFile)

    /* We can now get our compiler options, and check any and all overrides */
    const { errors, options } = await getCompilerOptions(
        tsconfig, // resolved tsconfig.json from constructor, might be undefined
        overrides) // overrides from constructor, might be an empty object

    /* Update report and fail on errors */
    updateReport(report, errors, baseDir)
    if (report.errors) report.done(true)

    /* Prep for compilation */
    const paths = [ ...files.absolutePaths() ]
    for (const path of paths) context.log.trace(`Compiling "${$p(path)}"`)
    context.log.info('Compiling', paths.length, 'files')

    /* If we have an extra types directory, add all the .d.ts files in there */
    if (extraTypesDir) {
      const directory = context.resolve(extraTypesDir)

      for await (const file of walk(directory, [ '**/*.d.ts' ])) {
        const path = resolveAbsolutePath(directory, file)
        context.log.debug(`Including extra type file "${$p(path)}"`)
        paths.push(path)
      }
    }

    /* Log out what we'll be our final compilation options */
    context.log.debug('Compliation options', options)

    /* Typescript host, create program and compile */
    const host = new TypeScriptHost(rootDir)
    const program = ts.createProgram(paths, options, host, undefined, errors)
    const diagnostics = ts.getPreEmitDiagnostics(program)

    /* Update report and fail on errors */
    updateReport(report, diagnostics, rootDir)
    if (report.errors) report.done(true)

    /* Write out all files asynchronously */
    const builder = Files.builder(outDir)
    const promises: Promise<void>[] = []
    const result = program.emit(undefined, (fileName, code) => {
      promises.push(builder.write(fileName, code).then((file) => {
        context.log.trace('Written', $p(file))
      }).catch(/* coverage ignore next */ (error) => {
        const outFile = resolveAbsolutePath(outDir, fileName)
        context.log.error('Error writing to', $p(outFile), error)
        throw BuildFailure.fail()
      }))
    })

    /* Await for all files to be written and check */
    await assertPromises(promises)

    /* Update report and fail on errors */
    updateReport(report, result.diagnostics, rootDir)
    /* coverage ignore if / only on write errors */
    if (report.errors) report.done(true)

    /* All done, build our files and return it */
    const outputs = builder.build()
    context.log.info('TSC produced', outputs.length, 'files into', $p(outputs.directory))
    return outputs
  }
}
