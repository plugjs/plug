import type { Files } from '../../files'
import type { Plug } from '../../pipe'
import type { Run } from '../../run'

import { ESLint as RealESLint } from 'eslint'

import { assert, failure } from '../../assert'
import { $p, ERROR, NOTICE, WARN } from '../../log'
import { getCurrentWorkingDirectory, isDirectory, isFile, resolveAbsolutePath } from '../../paths'
import { readFile } from '../../utils/asyncfs'

export interface ESLintOptions {
  /** ESLint's own _current working directory_, where config files are. */
  directory?: string
  /** Show sources in report? */
  showSources?: boolean
  /**
   * ESLint's _override_ configuration file: configurations specified in this
   * file will override any other configuration specified elsewhere.
   */
  configFile?: string
}

/** Writes some info about the current {@link Files} being passed around. */
export class ESLint implements Plug<undefined> {
  private readonly _options: Readonly<ESLintOptions>

  constructor()
  constructor(configFile: string)
  constructor(options: ESLintOptions)
  constructor(arg: string | ESLintOptions = {}) {
    this._options = typeof arg === 'string' ? { configFile: arg } : arg
  }

  async pipe(files: Files, run: Run): Promise<undefined> {
    const { directory, configFile } = this._options

    const cwd = directory ? run.resolve(directory) : getCurrentWorkingDirectory()
    assert(isDirectory(cwd), `ESLint directory ${$p(cwd)} does not exist`)

    const overrideConfigFile = configFile ? run.resolve(configFile) : undefined
    if (overrideConfigFile) {
      assert(isFile(overrideConfigFile), `ESLint configuration ${$p(overrideConfigFile)} does not exist`)
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
    report.done(this._options.showSources)
    return undefined
  }
}
