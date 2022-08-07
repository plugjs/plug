import type { Files } from '../../files'
import type { Plug } from '../../pipe'
import type { Run } from '../../run'

import { ESLint as RealESLint } from 'eslint'
import { $p } from '../../log'
import { getCurrentWorkingDirectory, resolveAbsolutePath } from '../../paths'
import { readFile } from '../../utils/asyncfs'
import { workerMain } from '../../worker'

export type ESLintWorkerType = typeof ESLintWorker

/** Writes some info about the current {@link Files} being passed around. */
class ESLintWorker implements Plug<undefined> {
  constructor(directory?: string)
  constructor(private readonly _directory?: string) {}

  async pipe(files: Files, run: Run): Promise<undefined> {
    /* The directory here is where `.eslintrc` can be found */
    const cwd = this._directory ? run.resolve(this._directory) : getCurrentWorkingDirectory()
    const eslint = new RealESLint({ cwd })

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
    if (! report.empty) report.emit()
    if (report.errors) report.fail()
    return undefined
  }
}

/** Run worker! */
workerMain(ESLintWorker)
