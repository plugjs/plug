import html from '@plugjs/cov8-html'
import { sep } from 'node:path'
import { Files } from '../files'
import { $grn, $gry, $p, $red, $ylw, fail, log } from '../log'
import { AbsolutePath, resolveAbsolutePath } from '../paths'
import { Plug, PlugContext } from '../plug'
import { mkdir, writeFile } from '../utils/asyncfs'

import { absoluteWalk } from '../utils/walk'
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

  async pipe(files: Files, context: PlugContext): Promise<Files> {
    const coverageDir = context.resolve(this._options.coverageDir)
    const coverageFiles = absoluteWalk(coverageDir, [ 'coverage-*.json' ])

    const report = await coverageReport(files.absolutePaths(), coverageFiles)

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

    const q = {
      'src': {
        'async.ts': 'src/async.ts',
        'utils': {

        }
      }
    }

    let fileErrors = 0;
    for (const [ file, result ] of Object.entries(report.results)) {
      const { coverage } = result.nodeCoverage
      const padding = ''.padEnd(maxLength - file.length, ' ')
      const percentage = `${coverage} %`.padStart(6)

      if (coverage < minimumFileCoverage) {
        log.error($p(file as AbsolutePath), padding, $red(percentage))
      } else if (coverage < optimalFileCoverage) {
        log.warn($p(file as AbsolutePath), padding, $ylw(percentage))
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
    }

    if (! this._options.reportDir) return context.files('.').build()

    const reportDir = context.resolve(this._options.reportDir)

    await mkdir(reportDir, { recursive: true })

    /* Thresholds to inject in the report */
    const date = new Date().toISOString()
    const thresholds = {
      minimumCoverage,
      minimumFileCoverage,
      optimalCoverage,
      optimalFileCoverage,
    }

    /* The JSON file in the report has *absolute* file paths */
    const jsonFile = resolveAbsolutePath(reportDir, 'report.json')
    await writeFile(jsonFile, JSON.stringify({ ...report, thresholds, date }))

    /* The HTML file rendering our report */
    const htmlFile = resolveAbsolutePath(reportDir, 'index.html')
    await writeFile(htmlFile, html)

    /* The JSONP file (for our HTML report) has relative files and a tree */
    const jsonpFile = resolveAbsolutePath(reportDir, 'report.js')

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
    await writeFile(jsonpFile, `window.__initCoverage__(${jsonp});`)

    /* Add the files we generated */
    return context.files(reportDir)
      .add(jsonFile)
      .add(htmlFile)
      .add(jsonpFile)
      .build()
  }
}

export function coverage(options: CoverageOptions): Coverage {
  return new Coverage(options)
}


type IgnoreCoverage = 'test' | 'if' | 'else' | 'try' | 'catch' | 'finally' | 'next'
const ignoreRegexp = /(coverage|istanbul)\s+ignore\s+(test|if|else|try|catch|finally|next)(\s|$)/g
