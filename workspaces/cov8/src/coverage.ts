import { sep } from 'node:path'

import { html, initFunction } from '@plugjs/cov8-html'
import { assert } from '@plugjs/plug/asserts'
import { Files } from '@plugjs/plug/files'
import { $gry, $ms, $p, $plur, $red, $ylw, ERROR, NOTICE, WARN } from '@plugjs/plug/logging'
import { resolveAbsolutePath } from '@plugjs/plug/paths'
import { walk } from '@plugjs/plug/utils'

import { createAnalyser } from './analysis.ts'
import { coverageReport } from './report.ts'

import type { Report, ReportLevel } from '@plugjs/plug/logging'
import type { AbsolutePath } from '@plugjs/plug/paths'
import type { Context, PipeParameters, Plug } from '@plugjs/plug/pipe'
import type { CoverageReportOptions } from './index.ts'
import type { CoverageReport, CoverageResult } from './report.ts'

function reportUncovered(
    report: Report,
    level: ReportLevel,
    file: AbsolutePath,
    lines: number[],
): void {
  if (! lines.length) return

  const ranges: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i]!
    let end = start
    while (lines[i + 1] === end + 1) {
      end = lines[++i]!
    }
    ranges.push(start === end ? `${start}` : `${start}\u2026${end}`)
  }

  report.add({ level, file, message: `Uncovered lines ${ranges.join(', ')}` })
}

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

    assert(coverageFiles.length > 0, `No coverage files found in ${$p(coverageDir)}`)
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
    let report: CoverageReport
    try {
      report = await coverageReport(analyser, sourceFiles, context.log)
    } finally {
      analyser.destroy()
    }
    context.log.info('Analysed', sourceFiles.length, 'source files', $ms(Date.now() - ms2))

    const {
      minimumCoverage = 50,
      minimumFileCoverage = minimumCoverage,
      optimalCoverage = Math.round((100 + minimumCoverage) / 2),
      optimalFileCoverage = Math.round((100 + minimumFileCoverage) / 2),
      reportUncoveredLines = false,
    } = this._options

    let fileErrors = 0
    let fileWarnings = 0
    const _report = context.log.report('Coverage report')

    for (const [ _file, result ] of Object.entries(report.results)) {
      const { nodeCoverage: { coverage }, uncoveredLines } = result
      const file = _file as AbsolutePath

      if (coverage == null) {
        _report.annotate(NOTICE, file, 'n/a')
      } else if (coverage < minimumFileCoverage) {
        _report.annotate(ERROR, file, `${coverage} %`)
        if (reportUncoveredLines) reportUncovered(_report, ERROR, file, uncoveredLines)
        fileErrors ++
      } else if (coverage < optimalFileCoverage) {
        _report.annotate(WARN, file, `${coverage} %`)
        if (reportUncoveredLines) reportUncovered(_report, WARN, file, uncoveredLines)
        fileWarnings ++
      } else {
        _report.annotate(NOTICE, file, `${coverage} %`)
        if (reportUncoveredLines) reportUncovered(_report, NOTICE, file, uncoveredLines)
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
      const f = $plur(fileErrors, 'file does', 'files do')
      const message = `${f} not meet minimum file coverage ${$gry(`(${minimumFileCoverage}%)`)}`
      _report.add({ level: ERROR, message })
    }
    if (fileWarnings) {
      /* coverage ignore next */
      const f = $plur(fileWarnings, 'file does', 'files do')
      const message = `${f} not meet optimal file coverage ${$gry(`(${optimalFileCoverage}%)`)}`
      _report.add({ level: WARN, message })
    }

    /* Finish console reporting when no report files were requested */
    if (this._options.reportDir == null) {
      _report.done(false)
      return
    }

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
    return builder.build()
  }
}
