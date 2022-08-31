import { ESLint as RealESLint } from 'eslint'
import { assert, failure } from '../../assert'
import { Files } from '../../files'
import { $p, ERROR, NOTICE, WARN } from '../../log'
import { getCurrentWorkingDirectory, resolveAbsolutePath, resolveDirectory, resolveFile } from '../../paths'
import { PipeParameters } from '../../pipe'
import { Plug, RunContext } from '../../types'
import { readFile } from '../../utils/asyncfs'
import { ESLintOptions } from '../eslint'

/** Runner implementation for the `ESLint` plug. */
export default class ESLint implements Plug<undefined> {
  private readonly _options: Readonly<ESLintOptions>

  constructor(...arg: PipeParameters<'eslint'>)
  constructor(arg: string | ESLintOptions = {}) {
    this._options = typeof arg === 'string' ? { configFile: arg } : arg
  }

  async pipe(files: Files, run: RunContext): Promise<undefined> {
    const { directory, configFile } = this._options

    const cwd = directory ? run.resolve(directory) : getCurrentWorkingDirectory()
    assert(resolveDirectory(cwd), `ESLint directory ${$p(cwd)} does not exist`)

    const overrideConfigFile = configFile ? run.resolve(configFile) : undefined
    if (overrideConfigFile) {
      assert(resolveFile(overrideConfigFile), `ESLint configuration ${$p(overrideConfigFile)} does not exist`)
    }

    /* Create our ESLint instance */
    const eslint = new RealESLint({ overrideConfigFile, cwd })

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
        run.log.error('Error linting', $p(paths[i]), settlement.reason)
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

    /* In case of failures from promises, fail! */
    const { results, failures } = summary
    if (failures) throw failure() // already logged above

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
        const level = severity === 0 ? NOTICE : severity === 1 ? WARN : ERROR

        /* Characters */
        const length = endLine === line ? endColumn - column : endLine > line ? -1 : 1

        /* Add our report */
        report.add({ level, message, tags, line, column, length, file, source })
      }
    }

    /* Emit our report and fail on errors */
    report.done(this._options.showSources)
    return undefined
  }
}
