import {
  CompilerHost,
  CompilerOptions,
  ScriptTarget,
  SourceFile,
  createSourceFile,
  getDefaultLibFilePath,
  sys,
} from 'typescript'

import {
  DiagnosticCategory,
  formatDiagnostics,
  formatDiagnosticsWithColorAndContext,
} from 'typescript'

import { Diagnostic, FormatDiagnosticsHost } from 'typescript'
import { fail } from '../assert'
import { $red, Logger, logOptions } from '../log'
import { AbsolutePath, resolveAbsolutePath } from '../paths'

export class TypeScriptHost
implements FormatDiagnosticsHost, CompilerHost {
  constructor(directory: AbsolutePath, log: Logger)
  constructor(
      private readonly _directory: AbsolutePath,
      private readonly _log: Logger,
  ) {}

  /* ======================================================================== */

  /** Get a source file parsing one of our virtual files */
  getSourceFile(
      fileName: string,
      languageVersion: ScriptTarget,
  ): SourceFile | undefined {
    const code = this.readFile(fileName)
    return code ? createSourceFile(fileName, code, languageVersion) : void 0
  }

  /** [TS] Never write any files */
  writeFile(fileName: string): void {
    throw new Error(`Cowardly refusing to write "${fileName}"`)
  }

  /** [TS] Get the default library associated with the given options */
  getDefaultLibFileName(options: CompilerOptions): string {
    return getDefaultLibFilePath(options)
  }

  /** [TS] Check for filesystem case sensitivity */
  useCaseSensitiveFileNames(): boolean {
    return sys.useCaseSensitiveFileNames
  }

  /** [TS] Check for the existence of a given file */
  fileExists(fileName: string): boolean {
    return sys.fileExists(resolveAbsolutePath(this.getCurrentDirectory(), fileName))
  }

  /** [TS] Read the file if it exists, otherwise return undefined */
  readFile(fileName: string): string | undefined {
    return sys.readFile(resolveAbsolutePath(this.getCurrentDirectory(), fileName))
  }

  /* ======================================================================== */

  /** [TS] Return the current working directory */
  getCurrentDirectory(): AbsolutePath {
    return this._directory
  }

  /** [TS] Return the canonical name for the specified file */
  getCanonicalFileName(fileName: string): string {
    if (sys.useCaseSensitiveFileNames) return fileName

    // Lifted from TypeScript sources
    const fileNameLowerCaseRegExp = /[^\u0130\u0131\u00DFa-z0-9\\/:\-_. ]+/g
    return fileNameLowerCaseRegExp.test(fileName) ?
      fileName.replace(fileNameLowerCaseRegExp, (s) => s.toLowerCase()) :
      fileName
  }

  /** [TS] Return the new line sequence used by this platform */
  getNewLine(): string {
    return sys.newLine
  }

  /* ======================================================================== */

  /** Check diagnostics and fail on TypeScript errors */
  checkDiagnostics(diagnostics: readonly Diagnostic[]): void {
    if (! diagnostics.length) return

    const format = logOptions.colors ?
      formatDiagnosticsWithColorAndContext :
      formatDiagnostics

    let errors = 0
    for (const diagnostic of diagnostics) {
      const message = format([ diagnostic ], this)
      switch (diagnostic.category) {
        case DiagnosticCategory.Error: this._log.error(message).sep(); errors ++; break
        case DiagnosticCategory.Warning: this._log.warn(message).sep(); break
        default: this._log.info(message).sep()
      }
    }

    if (errors) fail(`TypeScript reported ${$red(errors)} errors`)
  }
}
