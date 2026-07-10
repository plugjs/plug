import { $p } from '@plugjs/plug'
import { Files } from '@plugjs/plug/files'
import { getAbsoluteParent } from '@plugjs/plug/paths'
import ts from 'typescript'

import { updateReport } from './report'
import { buildWriteFile } from './writefile'

import type { Context, PipeParameters, Plug } from '@plugjs/plug/pipe'

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
