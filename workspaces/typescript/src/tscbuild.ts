import { $p, assert, fail, find } from '@plugjs/plug'
import { Files } from '@plugjs/plug/files'
import ts from 'typescript'

import { updateReport } from './report'
import { buildWriteFile } from './writefile'

import type { Pipe } from '@plugjs/plug'
import type { Context, PipeParameters, Plug } from '@plugjs/plug/pipe'

export class TscBuild implements Plug<Files> {
  private readonly _options: ts.BuildOptions

  constructor(...args: PipeParameters<'tscBuild'>) {
    this._options = {
      verbose: true,
      force: true,
      ...(args[0] || {}),
    }
  }

  async pipe(files: Files, context: Context): Promise<Files> {
    const report = context.log.report('TypeScript Builder Report')
    const builder = Files.builder(files.directory)
    const writeFile = buildWriteFile(builder, context)

    function reporter(diagnostic: ts.Diagnostic): void {
      updateReport(report, [ diagnostic ], files.directory, context.log)
    }

    const solutionBuilderHost = ts.createSolutionBuilderHost(
        ts.sys, // system
        undefined, // createProgram
        reporter, // reportDiagnostic
        reporter, // reportSolutionBuilderStatus
        undefined, // reportSolutionBuilderErrorSummary
    )

    const solutionBuilder = ts.createSolutionBuilder(
        solutionBuilderHost,
        [ ...files.absolutePaths() ],
        this._options,
    )

    const exitCode = solutionBuilder.build(
        undefined, // project (string)
        undefined, // cancellationToken
        writeFile, // writeFile
        undefined, // getCustomTransformers
    )

    let failure: boolean
    switch (exitCode) {
      case ts.ExitStatus.Success: // 0
        context.log.info('TSC Build completed successfully')
        failure = false
        break
      case ts.ExitStatus.DiagnosticsPresent_OutputsSkipped: // 1
        context.log.error('TSC Build failed with errors (see report)')
        failure = true
        break
      case ts.ExitStatus.DiagnosticsPresent_OutputsGenerated: // 2
        context.log.warn('TSC Build completed with errors (see report)')
        failure = true
        break
      case ts.ExitStatus.InvalidProject_OutputsSkipped: // 3
        context.log.error('TSC Build failed due to invalid project configuration')
        failure = true
        break
      case ts.ExitStatus.ProjectReferenceCycle_OutputsSkipped: // 4
        context.log.error('TSC Build failed due to project reference cycle')
        failure = true
        break
      default:
        context.log.error('TSC Build failed with exit code', exitCode)
        failure = true
        break
    }

    report.done(true)
    if (failure) fail('TSC Build failed')

    const outputs = builder.build()
    context.log.info('TSC Build produced', outputs.length, 'files into', $p(outputs.directory))
    return outputs
  }
}

/* ========================================================================== */

/** Options available for the TypeScript Builder. */
export interface TscBuildOptions extends ts.BuildOptions {
  /** The directory where to look for the `tsconfig.json` files. */
  directory?: string
}

/**
 * Run `tsc --build` using `tsconfig.json` from the current directory.
 *
 * @deprecated Use {@link tsc} instead.
 */
export function tscBuild(): Pipe
/**
 * Run `tsc --build` using the specified `tsconfig.json` file.
 *
 * @deprecated Use {@link tsc} instead.
 */
export function tscBuild(tsconfig: string): Pipe
/**
 * Run `tsc --build` using the specified options.
 *
 * The `directory` option specifies where to look for the `tsconfig.json` files,
 * and defaults to the current directory, `verbose` and `force` default to
 * `true`.
 *
 * @deprecated Use {@link tsc} instead.
 */
export function tscBuild(options: TscBuildOptions): Pipe
/**
 * Run `tsc --build` using the specified `tsconfig.json` and options.
 *
 * The `directory` option specifies where to look for the `tsconfig.json` files,
 * and defaults to the current directory, `verbose` and `force` default to
 * `true`.
 *
 * @deprecated Use {@link tsc} instead.
 */
export function tscBuild(tsconfig: string, options?: TscBuildOptions): Pipe
// Implementation overload
export function tscBuild(
    tsconfigOrOptions?: string | TscBuildOptions,
    maybeOptions?: TscBuildOptions,
): Pipe {
  return tsc(tsconfigOrOptions as string, maybeOptions as TscBuildOptions)
}

/**
 * Run `tsc --build` using `tsconfig.json` from the current directory.
 */
export function tsc(): Pipe
/**
 * Run `tsc --build` using the specified `tsconfig.json` file.
 */
export function tsc(tsconfig: string): Pipe
/**
 * Run `tsc --build` using the specified options.
 *
 * The `directory` option specifies where to look for the `tsconfig.json` files,
 * and defaults to the current directory, `verbose` and `force` default to
 * `true`.
 */
export function tsc(options: TscBuildOptions): Pipe
/**
 * Run `tsc --build` using the specified `tsconfig.json` and options.
 *
 * The `directory` option specifies where to look for the `tsconfig.json` files,
 * and defaults to the current directory, `verbose` and `force` default to
 * `true`.
 */
export function tsc(tsconfig: string, options?: TscBuildOptions): Pipe

// Implementation overload
export function tsc(
    tsconfigOrOptions?: string | TscBuildOptions,
    maybeOptions?: TscBuildOptions,
): Pipe {
  const [ tsconfig, tscBuildOptions ] =
    typeof tsconfigOrOptions === 'string'
      ? [ tsconfigOrOptions, maybeOptions ]
      : [ 'tsconfig.json', tsconfigOrOptions ]

  const { directory, ...buildOptions } = tscBuildOptions || {}
  return find(tsconfig, { directory })
      .plug((files) => {
        assert(files.length > 0, `No match for "${tsconfig}" in directory "${files.directory}"`)
        return files
      })
      .plug(new TscBuild(buildOptions))
}
