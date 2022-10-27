import ts from 'typescript' // TypeScript does NOT support ESM modules

import { resolveAbsolutePath } from '../../paths'

import type { AbsolutePath } from '../../paths'

export class TypeScriptHost
implements ts.CompilerHost {
  constructor(directory: AbsolutePath)
  constructor(private readonly _directory: AbsolutePath) {}

  /* ======================================================================== */

  /** Get a source file parsing one of our virtual files */
  getSourceFile(
      fileName: string,
      languageVersion: ts.ScriptTarget,
  ): ts.SourceFile | undefined {
    const code = this.readFile(fileName)
    return code ? ts.createSourceFile(fileName, code, languageVersion) : void 0
  }

  /** Never write any files */
  writeFile(fileName: string): void {
    throw new Error(`Cowardly refusing to write "${fileName}"`)
  }

  /** Get the default library associated with the given options */
  getDefaultLibFileName(options: ts.CompilerOptions): string {
    return ts.getDefaultLibFilePath(options)
  }

  /** Check for filesystem case sensitivity */
  useCaseSensitiveFileNames(): boolean {
    return ts.sys.useCaseSensitiveFileNames
  }

  /** Check for the existence of a given file */
  fileExists(fileName: string): boolean {
    return ts.sys.fileExists(resolveAbsolutePath(this.getCurrentDirectory(), fileName))
  }

  /** Read the file if it exists, otherwise return undefined */
  readFile(fileName: string): string | undefined {
    return ts.sys.readFile(resolveAbsolutePath(this.getCurrentDirectory(), fileName))
  }

  /** Return the current working directory */
  getCurrentDirectory(): AbsolutePath {
    return this._directory
  }

  /** Return the canonical name for the specified file */
  getCanonicalFileName(fileName: string): string {
    if (ts.sys.useCaseSensitiveFileNames) return fileName

    // Lifted from TypeScript sources
    const fileNameLowerCaseRegExp = /[^\u0130\u0131\u00DFa-z0-9\\/:\-_. ]+/g
    return fileNameLowerCaseRegExp.test(fileName) ?
      fileName.replace(fileNameLowerCaseRegExp, (s) => s.toLowerCase()) :
      fileName
  }

  /** Return the new line sequence used by this platform */
  getNewLine(): string {
    return ts.sys.newLine
  }
}
