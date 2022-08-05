import ts from 'typescript' // TypeScript does NOT support ESM modules

import { fail } from 'assert'
import { Files } from '../files'
import { $p, log, Report, ReportRecord } from '../log'
import { AbsolutePath, getCurrentWorkingDirectory, isFile, resolveAbsolutePath } from '../paths'
import { install, Plug } from '../pipe'
import { Run } from '../run'
import { ParseOptions, parseOptions } from '../utils/options'
import { TypeScriptHost } from './tsc/compiler'
import { getCompilerOptions } from './tsc/options'


export class Tsc implements Plug<Files> {
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
      console.log('FILENAME', fileName)
      void code
      // promises.push(builder.write(fileName, code).then((file) => {
      //   log.trace('Written', $p(file))
      // }))
    })

    updateReport(report, result.diagnostics, root)
    if (report.errors) report.emit(true).fail()

    const settlements = await Promise.allSettled(promises)
    for (const settlement of settlements) {
      if (settlement.status === 'rejected') fail('Error writing files')
    }

    const outputs = builder.build()
    log.info('TSC produced', outputs.length, 'files into', $p(outputs.directory))
    return outputs
  }
}

/* ========================================================================== *
 * INSTALLATION                                                               *
 * ========================================================================== */

install('tsc', Tsc)

declare module '../pipe' {
  export interface Pipe {
    tsc: PipeExtension<typeof Tsc>
  }
}

/* ========================================================================== *
 * INTERNAL                                                                   *
 * ========================================================================== */

function convertMessageChain(chain: ts.DiagnosticMessageChain, indent = 0): string[] {
  const message = `${''.padStart(indent * 2)}chain.messageText`

  if (chain.next) {
    const next = chain.next.map((c) => convertMessageChain(c, indent + 1))
    return [ message, ...next.flat(1) ]
  } else {
    return [ message ]
  }
}

function convertDiagnostics(
    diagnostics: readonly ts.Diagnostic[],
    directory: AbsolutePath,
): ReportRecord[] {
  return diagnostics.map((diagnostic): ReportRecord => {
    // console.log(diagnostic)
    void directory

    // Convert the `DiagnosticCategory` to our level
    let level: 'NOTICE' | 'ERROR' | 'WARN'
    switch (diagnostic.category) {
      case ts.DiagnosticCategory.Error: level = 'ERROR'; break
      case ts.DiagnosticCategory.Warning: level = 'WARN'; break
      default: level = 'NOTICE'
    }

    // Convert the `messageText` to a string
    let message: string | string[]
    if (typeof diagnostic.messageText === 'string') {
      message = diagnostic.messageText
    } else {
      message = convertMessageChain(diagnostic.messageText)
    }

    // Simple variables
    const tags = `TS${diagnostic.code}`


    if (diagnostic.file) {
      const { file: sourceFile, start, length } = diagnostic
      const file = resolveAbsolutePath(directory, sourceFile.fileName)
      const source = sourceFile.getFullText()

      if (start !== undefined) {
        const position = sourceFile.getLineAndCharacterOfPosition(start)
        let { line, character: column } = position
        column += 1
        line += 1

        return { level, message, tags, file, source, line, column, length }
      } else {
        return { level, message, tags, file, source }
      }
    } else {
      return { level, message, tags }
    }
  })
}

function updateReport(
    report: Report,
    diagnostics: readonly ts.Diagnostic[],
    directory: AbsolutePath,
): void {
  const records = convertDiagnostics(diagnostics, directory)
  report.add(...records)
}
