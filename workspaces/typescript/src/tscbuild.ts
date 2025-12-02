import { $p, fail } from '@plugjs/plug'
import { Files } from '@plugjs/plug/files'
import ts from 'typescript'

import { updateReport } from './report'
import { buildWriteFile } from './writefile'

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
