import html from '@plugjs/cov8-html'
import { sep } from 'node:path'
import { Files } from '../files'
import { $grn, $gry, $p, $red, $ylw, log } from '../log'
import { AbsolutePath } from '../paths'
import { Plug } from '../pipe'
import { Run } from '../run'
import { fail } from '../assert'

import { coverageReport, CoverageResult } from './report'

export interface CoverageOptions {
  coverageDir: string,
  minimumCoverage?: number,
  optimalCoverage?: number,
  minimumFileCoverage?: number,
  optimalFileCoverage?: number,
  reportDir?: string,
}

export class Coverage implements Plug {
  constructor(options: CoverageOptions)
  constructor(private _options: CoverageOptions) {}

  async pipe(files: Files, run: Run): Promise<Files | void> {
    const coverageFiles = await run.find('coverage-*.json', {
      directory: this._options.coverageDir,
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

    log.info('Coverage report:').sep()

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
        log.error($p(file as AbsolutePath), padding, $red(percentage))
        fileErrors ++
      } else if (coverage < optimalFileCoverage) {
        log.warn($p(file as AbsolutePath), padding, $ylw(percentage))
        fileWarnings ++
      } else {
        log.info($p(file as AbsolutePath), padding, $grn(percentage))
      }
    }

    if (report.nodes.coverage < minimumCoverage) {
      fail(`Coverage error: ${$red(`${report.nodes.coverage}%`)} does not meet minimum coverage ${$gry(`(${minimumCoverage}%)`)}`)
    } else if (report.nodes.coverage < optimalCoverage) {
      log.sep().warn(`Coverage: ${$ylw(`${report.nodes.coverage}%`)} does not meet optimal coverage ${$gry(`(${optimalCoverage}%)`)}`)
    } else {
      log.sep().info(`Coverage: ${$grn(`${report.nodes.coverage}%`)}`)
    }

    if (fileErrors) {
      fail(`Coverage error: ${$red(fileErrors)} files do not meet minimum file coverage ${$gry(`(${minimumFileCoverage}%)`)}`)
    } else if (fileWarnings) {
      log.sep().warn(`Coverage: ${$ylw(fileErrors)} files do not meet optimal file coverage ${$gry(`(${optimalFileCoverage}%)`)}`)
    }


    if (! this._options.reportDir) return

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
    return builder.build()
  }
}

export function coverage(options: CoverageOptions): Coverage {
  return new Coverage(options)
}
