import type { Files } from '../../files'
import type { Plug } from '../../pipe'
import type { Run } from '../../run'

import { ESLint } from 'eslint'
import { $p, ERROR, NOTICE, WARN } from '../../log'
import { AbsolutePath, getCurrentWorkingDirectory, resolveAbsolutePath } from '../../paths'
import { readFile } from '../../utils/asyncfs'
import { workerMain } from '../../worker'
import { failure } from '../../assert'

export type ESLintWorkerType = typeof ESLintWorker

/** Writes some info about the current {@link Files} being passed around. */
class ESLintWorker implements Plug<undefined> {
  constructor(
      private readonly _directory: AbsolutePath,
      private readonly _configFile: AbsolutePath | undefined,
      private readonly _showSources: boolean | undefined,
  ) {}

  async pipe(files: Files, run: Run): Promise<undefined> {
    /* Create our ESLint instance */
    const eslint = new ESLint({
      overrideConfigFile: this._configFile,
      cwd: this._directory,
    })

    /* Lint all files in parallel */
    const paths = [ ...files.absolutePaths() ]
    const promises = paths.map(async (filePath) => {
      const code = await readFile(filePath, 'utf-8')
      return eslint.lintText(code, { filePath })
    })

    /* Await for all promises to be settled */
    const settlements = await Promise.allSettled(promises)

    /* Run through all promises settlements */
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
      results: [] as ESLint.LintResult[],
      failures: 0,
    })

    /* In case of failures from promises, fail! */
    const { results, failures } = summary
    if (failures) throw failure() // already logged above

    /* Create our report */
    const report = run.report('ESLint Report')

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
        const level = severity === 0 ? NOTICE : severity === 1 ? WARN : ERROR

        /* Characters */
        const length = endLine === line ? endColumn - column : endLine > line ? -1 : 1

        /* Add our report */
        report.add({ level, message, tags, line, column, length, file, source })
      }
    }

    /* Emit our report and fail on errors */
    report.done(this._showSources)
    return undefined
  }
}

/** Run worker! */
workerMain(ESLintWorker)
