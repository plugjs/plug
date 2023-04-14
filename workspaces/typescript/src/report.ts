import ts from 'typescript' // TypeScript does NOT support ESM modules
import { ERROR, NOTICE, WARN } from '@plugjs/plug/logging'
import { resolveAbsolutePath } from '@plugjs/plug/paths'

import type { Report, ReportLevel, ReportRecord } from '@plugjs/plug/logging'
import type { AbsolutePath } from '@plugjs/plug/paths'


function convertMessageChain(chain: ts.DiagnosticMessageChain, indent = 0): string[] {
  const message = `${''.padStart(indent * 2)}${chain.messageText}`

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
    let level: ReportLevel
    switch (diagnostic.category) {
      case ts.DiagnosticCategory.Error: level = ERROR; break
      // coverage ignore next / generally not emitted
      case ts.DiagnosticCategory.Warning: level = WARN; break
      // coverage ignore next / message and suggestion
      default: level = NOTICE
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

      // coverage ignore else
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

/** Update a report, adding records from an array of {@link ts.Diagnostic} */
export function updateReport(
    report: Report,
    diagnostics: readonly ts.Diagnostic[],
    directory: AbsolutePath,
): void {
  const records = convertDiagnostics(diagnostics, directory)
  report.add(...records)
}
