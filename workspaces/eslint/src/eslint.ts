import { assert } from '@plugjs/plug'
import { BuildFailure } from '@plugjs/plug/asserts'
import { readFile } from '@plugjs/plug/fs'
import { $p, $grn, $ylw, ERROR, WARN, $gry } from '@plugjs/plug/logging'
import { getCurrentWorkingDirectory, resolveAbsolutePath, resolveDirectory, resolveFile } from '@plugjs/plug/paths'
import { ESLint as RealESLint } from 'eslint'

import type { Files } from '@plugjs/plug/files'
import type { Context, PipeParameters, Plug } from '@plugjs/plug/pipe'
import type { ESLintOptions } from './index'

/** Runner implementation for the `ESLint` plug. */
export class ESLint implements Plug<void> {
  private readonly _options: Readonly<ESLintOptions>

  constructor(...arg: PipeParameters<'eslint'>)
  constructor(arg: string | ESLintOptions = {}) {
    this._options = typeof arg === 'string' ? { configFile: arg } : arg
  }

  async pipe(files: Files, context: Context): Promise<void> {
    const { directory, configFile, ingoreDeprecatedRules, warnIgnored } = this._options

    const cwd = directory ? context.resolve(directory) : getCurrentWorkingDirectory()
    assert(resolveDirectory(cwd), `ESLint directory ${$p(cwd)} does not exist`)

    const overrideConfigFile = configFile ? context.resolve(configFile) : undefined
    if (overrideConfigFile) {
      assert(resolveFile(overrideConfigFile), `ESLint configuration ${$p(overrideConfigFile)} does not exist`)
    }

    /* Create our ESLint instance */
    const eslint = new RealESLint({
      globInputPaths: false, // we already have all globs resolved
      overrideConfigFile, // if any override config file was supplied...
      cwd, // current working directory for eslint (where everything starts)
    })

    /* Lint all files in parallel */
    const paths = [ ...files.absolutePaths() ]
    const promises = paths.map(async (filePath) => {
      const code = await readFile(filePath, 'utf-8')
      return eslint.lintText(code, { filePath, warnIgnored: !!warnIgnored })
    })

    /* Await for all promises to be settled */
    const settlements = await Promise.allSettled(promises)

    /* Run through all promises settlements */
    const summary = settlements.reduce((summary, settlement, i) => {
      /* Promise rejected, meaining hard failure */
      if (settlement.status === 'rejected') {
        context.log.error('Error linting', $p(paths[i]!), settlement.reason)
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
    if (failures) throw BuildFailure.fail()

    /* Create our report */
    const report = context.log.report('ESLint Report')

    /* Keep an eye on deprecated rules */
    const deprecated: Record<string, string[]> = {}

    /* Convert ESLint results into our report records */
    for (const result of results) {
      const { filePath, source, messages } = result
      const file = resolveAbsolutePath(getCurrentWorkingDirectory(), filePath)

      for (const deprecation of result.usedDeprecatedRules) {
        deprecated[deprecation.ruleId] = deprecation.replacedBy
      }

      for (const record of messages) {
        const {
          severity,
          message: msg,
          ruleId: tags,
          suggestions = [],
          line,
          column,
          endLine = line,
          endColumn = column + 1,
        } = record

        const message = [ msg ]
        for (const suggestion of suggestions) {
          message.push(`- ${suggestion.desc}`)
        }

        /* Severity: 0 => off, 1 => warn, 2 => error */
        const level = severity < 2 ? WARN : ERROR

        /* Characters (length of -1 is until EOL) */
        const length = endLine === line ? endColumn - column : -1

        /* Add our report */
        report.add({ level, message, tags, line, column, length, file, source })
      }
    }

    /* Report ESLint deprecated rules */
    if (! ingoreDeprecatedRules) {
      for (const [ rule, replacedBy ] of Object.entries(deprecated)) {
        if (replacedBy.length) {
          const replacements = replacedBy.map($grn)
          replacements.unshift('')
          const repl = replacements.join(`\n${$gry('*')} `)
          report.add({ level: WARN, message: `Rule ${$ylw(rule)} was deprecated and replaced by ${repl}` })
        } else {
          report.add({ level: WARN, message: `Rule ${$ylw(rule)} was deprecated without replacement` })
        }
      }
    }

    /* Emit our report and fail on errors */
    report.done(this._options.showSources)
    context.log.notice('ESLint processed', files.length, 'files')
  }
}
