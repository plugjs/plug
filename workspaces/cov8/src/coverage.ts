// Reference ourselves, so that the constructor's parameters are correct
/// <reference path="./index.ts"/>

import { sep } from 'node:path'

import { html, initFunction } from '@plugjs/cov8-html'
import { Files } from '@plugjs/plug/files'
import { $gry, $ms, $p, $red, $ylw, ERROR, NOTICE, WARN } from '@plugjs/plug/logging'
import { resolveAbsolutePath } from '@plugjs/plug/paths'
import { walk } from '@plugjs/plug/utils'

import { createAnalyser } from './analysis'
import { coverageReport } from './report'

import type { AbsolutePath } from '@plugjs/plug/paths'
import type { Context, PipeParameters, Plug } from '@plugjs/plug/pipe'
import type { CoverageReportOptions } from './index'
import type { CoverageResult } from './report'

export class Coverage implements Plug<Files | undefined> {
  constructor(...args: PipeParameters<'coverage'>)
  constructor(
      private readonly _coverageDir: string,
      private readonly _options: Partial<CoverageReportOptions> = {},
  ) {}

  async pipe(files: Files, context: Context): Promise<Files | undefined> {
    const coverageDir = context.resolve(this._coverageDir)
    const coverageFiles: AbsolutePath[] = []
    for await (const file of walk(coverageDir, [ 'coverage-*.json' ])) {
      coverageFiles.push(resolveAbsolutePath(coverageDir, file))
    }

    if (coverageFiles.length === 0) {
      throw context.log.fail(`No coverage files found in ${$p(coverageDir)}`)
    }

    const sourceFiles = [ ...files.absolutePaths() ]

    const ms1 = Date.now()
    const analyser = await createAnalyser(
        sourceFiles,
        coverageFiles,
        this._options.sourceMapBias || 'least_upper_bound',
        context.log,
    )
    context.log.info('Parsed', coverageFiles.length, 'coverage files', $ms(Date.now() - ms1))

    const ms2 = Date.now()
    const report = await coverageReport(analyser, sourceFiles, context.log)
    context.log.info('Analysed', sourceFiles.length, 'source files', $ms(Date.now() - ms2))

    analyser.destroy()

    const {
      minimumCoverage = 50,
      minimumFileCoverage = minimumCoverage,
      optimalCoverage = Math.round((100 + minimumCoverage) / 2),
      optimalFileCoverage = Math.round((100 + minimumFileCoverage) / 2),
    } = this._options

    let max = 0
    for (const file in report) {
      if (file.length > max) max = file.length
    }

    let maxLength = 0
    for (const file in report.results) {
      if (file.length > maxLength) maxLength = file.length
    }

    let fileErrors = 0
    let fileWarnings = 0
    const _report = context.log.report('Coverage report')

    for (const [ _file, result ] of Object.entries(report.results)) {
      const { coverage } = result.nodeCoverage
      const file = _file as AbsolutePath

      if (coverage == null) {
        _report.annotate(NOTICE, file, 'n/a')
      } else if (coverage < minimumFileCoverage) {
        _report.annotate(ERROR, file, `${coverage} %`)
        fileErrors ++
      } else if (coverage < optimalFileCoverage) {
        _report.annotate(WARN, file, `${coverage} %`)
        fileWarnings ++
      } else {
        _report.annotate(NOTICE, file, `${coverage} %`)
      }
    }

    /* coverage ignore if */
    if (report.nodes.coverage == null) {
      const message = 'No coverage data collected'
      _report.add({ level: WARN, message })
    } else if (report.nodes.coverage < minimumCoverage) {
      const message = `${$red(`${report.nodes.coverage}%`)} does not meet minimum coverage ${$gry(`(${minimumCoverage}%)`)}`
      _report.add({ level: ERROR, message })
    } else if (report.nodes.coverage < optimalCoverage) {
      const message = `${$ylw(`${report.nodes.coverage}%`)} does not meet optimal coverage ${$gry(`(${optimalCoverage}%)`)}`
      _report.add({ level: WARN, message })
    }

    if (fileErrors) {
      /* coverage ignore next */
      const f = fileErrors === 1 ? 'file does' : 'files do'
      const message = `${$red(fileErrors)} ${f} not meet minimum file coverage ${$gry(`(${minimumFileCoverage}%)`)}`
      _report.add({ level: ERROR, message })
    }
    if (fileWarnings) {
      /* coverage ignore next */
      const f = fileErrors === 1 ? 'file does' : 'files do'
      const message = `${$ylw(fileWarnings)} ${f} not meet optimal file coverage ${$gry(`(${optimalFileCoverage}%)`)}`
      _report.add({ level: WARN, message })
    }

    /* If we don't have to write a report, pass-through the coverage files */
    if (this._options.reportDir == null) return _report.done(false) as any

    /* Create a builder to emit our reports */
    const reportDir = context.resolve(this._options.reportDir)
    const builder = Files.builder(reportDir)

    /* Thresholds to inject in the report */
    const date = new Date().toISOString()
    const thresholds = {
      minimumCoverage,
      minimumFileCoverage,
      optimalCoverage,
      optimalFileCoverage,
    }

    /* The JSON file in the report has *absolute* file paths */
    await builder.write('report.json', JSON.stringify({ ...report, thresholds, date }))

    /* The HTML file rendering our report */
    await builder.write('index.html', html)

    /* The JSONP file (for our HTML report) has relative files and a tree */
    const results: Record<string, CoverageResult> = {}
    for (const [ rel, abs ] of files.pathMappings()) {
      results[rel] = report.results[abs]!
    }

    const tree: Record<string, any> = {}
    for (const relative of Object.keys(results)) {
      const directories = relative.split(sep)
      const file = directories.pop()!

      let node = tree
      for (const dir of directories) {
        node = node[dir] = node[dir] || {}
      }

      node[file] = relative
    }

    const jsonp = JSON.stringify({ ...report, results, thresholds, tree, date })
    await builder.write('report.js', `${initFunction}(${jsonp});`)

    /* Emit our coverage report */
    _report.done(false)

    /* Return emitted files */
    return builder.build() as any
  }
}
