import { $p, assert, find } from '@plugjs/plug'
import { Files } from '@plugjs/plug/files'
import { getAbsoluteParent } from '@plugjs/plug/paths'
import ts from 'typescript'

import { updateReport } from './report.ts'
import { buildWriteFile } from './writefile.ts'

import type { Pipe } from '@plugjs/plug'
import type { Context, PipeParameters, Plug } from '@plugjs/plug/pipe'
import type { TscCompilerOptions } from './index.ts'

export class TscCompiler implements Plug<Files> {
  private readonly _options: ts.CompilerOptions

  constructor(...args: PipeParameters<'tscCompiler'>) {
    this._options = {
      verbose: true,
      force: true,
      ...(args[0] || {}),
    }
  }

  async pipe(files: Files, context: Context): Promise<Files> {
    const report = context.log.report('TypeScript Compiler Report')
    const builder = Files.builder(files.directory)
    const writeFile = buildWriteFile(builder, context)

    for (const absoluteConfigPath of files.absolutePaths()) {
      context.log.notice('Compiling TypeScript project', $p(absoluteConfigPath))
      const configDir = getAbsoluteParent(absoluteConfigPath)

      /* Read the config file */
      const configFile = ts.readConfigFile(
          absoluteConfigPath,
          ts.sys.readFile,
      )

      if (configFile.error) {
        updateReport(report, [ configFile.error ], configDir)
        if (report.errors) report.done(true)
      }

      /* Parse the config file */
      const parsedConfig = ts.parseJsonConfigFileContent(
          configFile.config, // the JSON
          ts.sys, // the system
          configDir, // the base directory to resolve relative paths
          this._options, // existing options to merge with
          absoluteConfigPath, // the config file name
      )

      if (parsedConfig.errors.length > 0) {
        updateReport(report, parsedConfig.errors, configDir)
        if (report.errors) report.done(true)
      }

      /* Create the program */
      const program = ts.createProgram({
        rootNames: parsedConfig.fileNames,
        options: parsedConfig.options,
        projectReferences: parsedConfig.projectReferences,
        configFileParsingDiagnostics: parsedConfig.errors,
      })

      const diagnostics = ts.getPreEmitDiagnostics(program)
      updateReport(report, diagnostics, configDir)
      if (report.errors) report.done(true)

      const result = program.emit(undefined, writeFile)
      updateReport(report, result.diagnostics, configDir)
      if (report.errors) report.done(true)
    }

    const result = builder.build()
    context.log.info('TSC Build produced', result.length, 'files into', $p(result.directory))
    return result
  }
}

/* ========================================================================== */

/** Options available for the TypeScript Compiler. */
export interface ExtendedTscCompilerOptions extends TscCompilerOptions {
  /** The directory where to look for the `tsconfig.json` files. */
  directory?: string
}

/**
 * Run `tsc --project` using `tsconfig.json` from the current directory.
 */
export function tsc(): Pipe
/**
 * Run `tsc --project` using the specified `tsconfig.json` file.
 */
export function tsc(tsconfig: string): Pipe
/**
 * Run `tsc --project` using the specified options.
 *
 * The `directory` option specifies where to look for the `tsconfig.json` files,
 * and defaults to the current directory, `verbose` and `force` default to
 * `true`.
 */
export function tsc(options: ExtendedTscCompilerOptions): Pipe
/**
 * Run `tsc --project` using the specified `tsconfig.json` and options.
 *
 * The `directory` option specifies where to look for the `tsconfig.json` files,
 * and defaults to the current directory, `verbose` and `force` default to
 * `true`.
 */
export function tsc(tsconfig: string, options?: ExtendedTscCompilerOptions): Pipe
// Implementation overload
export function tsc(
    tsconfigOrOptions?: string | ExtendedTscCompilerOptions,
    maybeOptions?: ExtendedTscCompilerOptions,
): Pipe {
  const [ tsconfig, tscCompilerOptions ] =
    typeof tsconfigOrOptions === 'string'
      ? [ tsconfigOrOptions, maybeOptions ]
      : [ 'tsconfig.json', tsconfigOrOptions ]

  const { directory, ...compilerOptions } = tscCompilerOptions || {}
  return find(tsconfig, { directory })
      .plug((files) => {
        assert(files.length > 0, `No match for "${tsconfig}" in directory "${files.directory}"`)
        return files
      })
      .plug(new TscCompiler(compilerOptions))
}
