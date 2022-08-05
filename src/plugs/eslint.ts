import type { Files } from '../files'
import type { Run } from '../run'

import { install, Plug } from '../pipe'

import { ESLint as RealESLint } from 'eslint'
import { getCurrentWorkingDirectory, resolveAbsolutePath } from '../paths'
import { readFile } from '../utils/asyncfs'
import { $p } from '../log'

/** Writes some info about the current {@link Files} being passed around. */
export class ESLint implements Plug<undefined> {
  constructor() {}

  async pipe(files: Files, run: Run): Promise<undefined> {
    const eslint = new RealESLint({})

    const paths = [ ...files.absolutePaths() ]
    const promises = paths.map(async (filePath) => {
      const code = await readFile(filePath, 'utf-8')
      return eslint.lintText(code, { filePath })
    })

    const settlements = await Promise.allSettled(promises)

    const summary = settlements.reduce((summary, settlement, i) => {
      /* Promise rejected, meaining hard failure */
      if (settlement.status === 'rejected') {
        run.log.error('Error linting', $p(paths[i]), settlement.status)
        summary.failures ++
        return summary
      }

      /* Push all our results in the summary */
      summary.results.push(...settlement.value)
      return summary
    }, {
      results: [] as RealESLint.LintResult[],
      failures: 0,
    })

    const { results, failures } = summary
    if (failures) run.log.fail('ESLint failed linting')

    /* Create our report */
    const report = run.log.report('ESLint Report')

    /* Convert ESLint results into our report records */
    for (const result of results) {
      const { filePath, source, messages } = result
      const file = resolveAbsolutePath(getCurrentWorkingDirectory(), filePath)

      for (const record of messages) {
        const {
          severity,
          message,
          ruleId: tags,
          line,
          column,
          endLine = line,
          endColumn = column + 1,
        } = record

        /* Severity becomes our "kind" */
        const level = severity === 0 ? 'NOTICE' : severity === 1 ? 'WARN' : 'ERROR'

        /* Characters */
        const length = endLine === line ? endColumn - column : endLine > line ? -1 : 1

        /* Add our report */
        report.add({ level, message, tags, line, column, length, file, source })
      }
    }

    /* Emit our report and fail on errors */
    const { errors } = report.emit()
    if (errors) run.log.fail('Found ESLint errors')
    return undefined
  }
}

/* ========================================================================== *
 * INSTALLATION                                                               *
 * ========================================================================== */

install('eslint', ESLint)

declare module '../pipe' {
  export interface Pipe {
    /** Writes some info about the current {@link Files} being passed around. */
    eslint: PipeExtension<typeof ESLint>
  }
}
