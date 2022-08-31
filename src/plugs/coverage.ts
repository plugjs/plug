import { html, initFunction } from '@plugjs/cov8-html'
import { sep } from 'node:path'
import { fail } from '../assert'
import { Files } from '../files'
import { $gry, $ms, $p, $red, $ylw, ERROR, NOTICE, WARN } from '../log'
import { AbsolutePath, resolveAbsolutePath } from '../paths'
import { install, PipeParameters } from '../pipe'
import { Plug, Result, RunContext } from '../types'
import { walk } from '../utils/walk'
import { createAnalyser, SourceMapBias } from './coverage/analysis'
import { coverageReport, CoverageResult } from './coverage/report'

/** Options to analyse coverage reports */
export interface CoverageOptions {
  /** The bias for source map analisys (defaults to `greatest_lower_bound`) */
  sourceMapBias?: SourceMapBias
  /** Minimum _overall_ coverage (as a percentage, defaults to 50) */
  minimumCoverage?: number,
  /** Optimal _overall_ coverage (as a percentage, defaults to 50)  */
  optimalCoverage?: number,
  /** Minimum _per-file_ coverage (as a percentage, defaults to 75) */
  minimumFileCoverage?: number,
  /** Optimal _per-file_ coverage (as a percentage, defaults to 75) */
  optimalFileCoverage?: number,
}

export interface CoverageReportOptions extends CoverageOptions {
  /** If specified, a JSON and HTML report will be written to this directory */
  reportDir: string,
}

declare module '../pipe' {
  export interface Pipe {
    /**
     * Analyse coverage using files generated by V8/NodeJS.
     *
     * @param coverageDir The directory where the `coverage-XXX.json` files
     *                    generated by V8/NodeJS can be found.
     */
    coverage(coverageDir: string): Call
    /**
     * Analyse coverage using files generated by V8/NodeJS.
     *
     * @param coverageDir The directory where the `coverage-XXX.json` files
     *                    generated by V8/NodeJS can be found.
     * @param options Extra {@link CoverageOptions | options} allowing to
     *                specify coverage thresholds.
     */
    coverage(coverageDir: string, options: CoverageOptions): Call
    /**
     * Analyse coverage using files generated by V8/NodeJS and produce an HTML
     * report in the directory specified in `options`.
     *
     * @param coverageDir The directory where the `coverage-XXX.json` files
     *                    generated by V8/NodeJS can be found.
     * @param options Extra {@link CoverageOptions | options} allowing to
     *                specify coverage thresholds where the HTML report should
     *                be written to.
     */
    coverage(coverageDir: string, options: CoverageReportOptions): Pipe
  }
}

/* ========================================================================== *
 * INSTALLATION / IMPLEMENTATION                                              *
 * ========================================================================== */

install('coverage', class Coverage implements Plug {
  constructor(...args: PipeParameters<'coverage'>)
  constructor(
      private readonly _coverageDir: string,
      private readonly _options: Partial<CoverageReportOptions> = {},
  ) {}

  async pipe(files: Files, run: RunContext): Promise<Result> {
    const coverageDir = run.resolve(this._coverageDir)
    const coverageFiles: AbsolutePath[] = []
    for await (const file of walk(coverageDir, [ 'coverage-*.json' ])) {
      coverageFiles.push(resolveAbsolutePath(coverageDir, file))
    }

    if (coverageFiles.length === 0) {
      fail(`No coverage files found in ${$p(coverageDir)}`)
    }

    const sourceFiles = [ ...files.absolutePaths() ]

    const ms1 = Date.now()
    const analyser = await createAnalyser(
        sourceFiles,
        coverageFiles,
        this._options.sourceMapBias || 'least_upper_bound',
        run.log,
    )
    run.log.info('Parsed', coverageFiles.length, 'coverage files', $ms(Date.now() - ms1))

    const ms2 = Date.now()
    const report = await coverageReport(analyser, sourceFiles, run.log)
    run.log.info('Analysed', sourceFiles.length, 'source files', $ms(Date.now() - ms2))

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
    const _report = run.log.report('Coverage report')

    for (const [ _file, result ] of Object.entries(report.results)) {
      const { coverage, totalNodes } = result.nodeCoverage
      const file = _file as AbsolutePath

      if (totalNodes === 0) {
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

    if (report.nodes.coverage < minimumCoverage) {
      const message = `${$red(`${report.nodes.coverage}%`)} does not meet minimum coverage ${$gry(`(${minimumCoverage}%)`)}`
      _report.add({ level: ERROR, message })
    } else if (report.nodes.coverage < optimalCoverage) {
      const message = `${$ylw(`${report.nodes.coverage}%`)} does not meet optimal coverage ${$gry(`(${optimalCoverage}%)`)}`
      _report.add({ level: WARN, message })
    }

    if (fileErrors) {
      const message = `${$red(fileErrors)} files do not meet minimum file coverage ${$gry(`(${minimumFileCoverage}%)`)}`
      _report.add({ level: ERROR, message })
    }
    if (fileWarnings) {
      const message = `${$ylw(fileWarnings)} files do not meet optimal file coverage ${$gry(`(${optimalFileCoverage}%)`)}`
      _report.add({ level: WARN, message })
    }

    /* If we don't have to write a report, pass-through the coverage files */
    if (this._options.reportDir == null) return _report.done(false) as any

    /* Create a builder to emit our reports */
    const reportDir = run.resolve(this._options.reportDir)
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
      results[rel] = report.results[abs]
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
})
