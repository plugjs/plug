// Reference ourselves, so that the constructor's parameters are correct
/// <reference path="./index.ts"/>

import { assert, assertPromises, BuildFailure } from '@plugjs/plug/asserts'
import { Files } from '@plugjs/plug/files'
import { $p } from '@plugjs/plug/logging'
import { commonPath, resolveAbsolutePath, resolveFile } from '@plugjs/plug/paths'
import { parseOptions, walk } from '@plugjs/plug/utils'
import ts from 'typescript'

import { TypeScriptHost } from './compiler'
import { getCompilerOptions } from './options'
import { updateReport } from './report'

import type { AbsolutePath } from '@plugjs/plug/paths'
import type { Context, PipeParameters, Plug } from '@plugjs/plug/pipe'
import type { ExtendedCompilerOptions } from './index'


/* ========================================================================== *
 * WORKER PLUG                                                                *
 * ========================================================================== */

function defaultRootDir(paths: AbsolutePath[]): AbsolutePath {
  const [ firstPath, ...restPaths ] = paths.filter((path) => {
    return ! path.match(/\.d\.[mc]ts$/i)
  })

  assert(firstPath, 'No non-declaration files found to compile')
  return commonPath(firstPath, ...restPaths)
}

export class Tsc implements Plug<Files> {
  private readonly _tsconfig?: string
  private readonly _options: ExtendedCompilerOptions

  constructor(...args: PipeParameters<'tsc'>) {
    const { params: [ tsconfig ], options } = parseOptions(args, {})
    this._tsconfig = tsconfig
    this._options = options
  }

  async pipe(files: Files, context: Context): Promise<Files> {
    const paths = [ ...files.absolutePaths() ]

    /* Start preparing the report that will be used throughout */
    const report = context.log.report('TypeScript Report')

    /* Clone our options and add extra types to our sources */
    const { extraTypesDir, ...__overrides } = { ...this._options }

    if (extraTypesDir) {
      const directory = context.resolve(extraTypesDir)

      for await (const file of walk(directory, [ '**/*.d.ts' ])) {
        const path = resolveAbsolutePath(directory, file)
        context.log.debug(`Including extra type file "${$p(path)}"`)
        paths.push(path)
      }
    }

    /*
     * The "tsconfig" file is either specified, or (if existing) first checked
     * alongside the sources, otherwise checked in the current directory.
     */
    const sourcesConfig = resolveFile(files.directory, 'tsconfig.json')
    const tsconfig = this._tsconfig ? context.resolve(this._tsconfig) :
      sourcesConfig || resolveFile(context.resolve('tsconfig.json'))

    /* Root directory must always exist */
    // let rootDir: AbsolutePath
    if (__overrides.rootDir) {
      __overrides.rootDir = context.resolve(__overrides.rootDir)
    }

    /* Output directory _also_ must always exist */
    // let outDir: AbsolutePath
    if (__overrides.outDir) {
      __overrides.outDir = context.resolve(__overrides.outDir)
    }

    /* All other root paths */
    if (__overrides.rootDirs) {
      __overrides.rootDirs = __overrides.rootDirs.map((dir) => context.resolve(dir))
    }

    /* The baseURL is resolved, as well */
    if (__overrides.baseUrl) __overrides.baseUrl = context.resolve(__overrides.baseUrl)

    /* The baseURL is resolved, as well */
    if (__overrides.outFile) __overrides.outFile = context.resolve(__overrides.outFile)

    /* We can now get our compiler options, and check any and all overrides */
    const { errors, options } = await getCompilerOptions(
        tsconfig, // resolved tsconfig.json from constructor, might be undefined
        __overrides,
        paths,
    ) // overrides from constructor, might be an empty object

    /* Update report and fail on errors */
    updateReport(report, errors, context.resolve('.'))
    if (report.errors) report.done(true)

    /* Prep for compilation */
    for (const path of paths) context.log.debug(`Compiling "${$p(path)}"`)
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

    /* Figure out the root directory, either from the options, or default */
    const rootDir = options.rootDir ?
        context.resolve(options.rootDir) :
        defaultRootDir(paths)
    if (!(options.rootDir || options.rootDirs)) options.rootDir = rootDir

    /* Figure out the output directory, either from the options or same as root */
    const outDir = options.outDir ? context.resolve(options.outDir) : rootDir
    if (!(options.outDir || options.outFile)) options.outDir = outDir

    /* Log out what we'll be our final compilation options */
    context.log.info('Compliation options', options)

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
