import html from '@plugjs/cov8-html'

import type { Files } from '../files'
import type { AbsolutePath } from '../paths'
import type { Run } from '../run'

import { sep } from 'node:path'

import { $grn, $gry, $p, $red, $ylw } from '../log'
import { install, Plug } from '../pipe'
import { coverageReport, CoverageResult } from './coverage/report'

/** Options to analyse coverage reports */
export interface CoverageOptions {
  /** Minimum _overall_ coverage (as a percentage) */
  minimumCoverage?: number,
  /** Optimal _overall_ coverage (as a percentage)  */
  optimalCoverage?: number,
  /** Minimum _per-file_ coverage (as a percentage) */
  minimumFileCoverage?: number,
  /** Optimal _per-file_ coverage (as a percentage) */
  optimalFileCoverage?: number,
}

export interface CoverageReportOptions extends CoverageOptions {
  /** If specified, a JSON and HTML report will be written to this directory */
  reportDir: string,
}

/**
 * The {@link Coverage} plug type is inferred from the constructor, so this
 * type helps to declare the correct types as we can't really infer them from
 * `typeof Coverage`...
 */
type CoverageConstructor = {
  new (coverageDir: string): Coverage<CoverageOptions>
  new (coverageDir: string, options: CoverageOptions): Coverage<CoverageOptions>
  new (coverageDir: string, options: CoverageReportOptions): Coverage<CoverageReportOptions>
}

/** Analyse coverage using files generated by V8/NodeJS. */
export class Coverage<
  T extends CoverageOptions | CoverageReportOptions,
> implements Plug<T extends CoverageReportOptions ? Files : undefined> {
  constructor(coverageDir: string)
  constructor(coverageDir: string, options?: T)
  constructor(
      private readonly _coverageDir: string,
      private readonly _options: Partial<CoverageReportOptions> = {},
  ) {}

  async pipe(files: Files, run: Run): Promise<T extends CoverageReportOptions ? Files : undefined> {
    const coverageFiles = await run.find('coverage-*.json', {
      directory: this._coverageDir,
    })

    const report = await coverageReport(
        files.absolutePaths(),
        coverageFiles.absolutePaths(),
    )

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

    run.log.info('Coverage report:')

    let maxLength = 0
    for (const file in report.results) {
      if (file.length > maxLength) maxLength = file.length
    }

    let fileErrors = 0
    let fileWarnings = 0
    for (const [ file, result ] of Object.entries(report.results)) {
      const { coverage } = result.nodeCoverage
      const padding = ''.padEnd(maxLength - file.length, ' ')
      const percentage = `${coverage} %`.padStart(6)

      if (coverage < minimumFileCoverage) {
        run.log.error($p(file as AbsolutePath), padding, $red(percentage))
        fileErrors ++
      } else if (coverage < optimalFileCoverage) {
        run.log.warn($p(file as AbsolutePath), padding, $ylw(percentage))
        fileWarnings ++
      } else {
        run.log.info($p(file as AbsolutePath), padding, $grn(percentage))
      }
    }

    const finalizeReport = ((): void => {
      if (report.nodes.coverage < minimumCoverage) {
        run.log.fail(`Coverage error: ${$red(`${report.nodes.coverage}%`)} does not meet minimum coverage ${$gry(`(${minimumCoverage}%)`)}`)
      } else if (report.nodes.coverage < optimalCoverage) {
        run.log.warn(`Coverage: ${$ylw(`${report.nodes.coverage}%`)} does not meet optimal coverage ${$gry(`(${optimalCoverage}%)`)}`)
      } else {
        run.log.info(`Coverage: ${$grn(`${report.nodes.coverage}%`)}`)
      }

      if (fileErrors) {
        run.log.fail(`Coverage error: ${$red(fileErrors)} files do not meet minimum file coverage ${$gry(`(${minimumFileCoverage}%)`)}`)
      } else if (fileWarnings) {
        run.log.warn(`Coverage: ${$ylw(fileErrors)} files do not meet optimal file coverage ${$gry(`(${optimalFileCoverage}%)`)}`)
      }
    })

    /* If we don't have to write a report, pass-through the coverage files */
    if (this._options.reportDir == null) {
      finalizeReport()
      return undefined as any
    }

    /* Create a builder to emit our reports */
    const builder = run.files(this._options.reportDir)

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
    await builder.write('report.js', `window.__initCoverage__(${jsonp});`)

    /* Add the files we generated */
    finalizeReport()
    return builder.build() as any
  }
}

/* ========================================================================== *
 * INSTALLATION                                                               *
 * ========================================================================== */

install('coverage', Coverage)

declare module '../pipe' {
  export interface Pipe {
    /** Analyse coverage using files generated by V8/NodeJS. */
    coverage: PipeExtension<CoverageConstructor>
  }
}
