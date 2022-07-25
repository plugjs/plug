import { resolve, sep } from 'node:path'
import { AbsolutePath, Files, getRelativeChildPath, resolveAbsolutePath } from '../files'
import { $grn, $gry, $p, $red, $ylw, fail, log } from '../log'
import { Plug } from '../pipe'
import { Run } from '../run'

import { absoluteWalk } from '../utils/walk'
import { coverageReport, CoverageResult } from './report'

export interface CoverageOptions {
  coverageDir: string,
  minimumCoverage?: number,
  optimalCoverage?: number,
  minimumFileCoverage?: number,
  optimalFileCoverage?: number,
}

export class Coverage implements Plug {

  constructor(options: CoverageOptions)
  constructor(private _options: CoverageOptions) {}

  async pipe(run: Run, files: Files): Promise<Files> {
    const coverageDir = resolveAbsolutePath(run.directory, this._options.coverageDir)
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

    if (fileErrors) {
      fail(`Coverage error: ${$red(fileErrors)} files do not meet minimum file coverage ${$gry(`(${minimumFileCoverage}%)`)}`)
    }

    if (report.nodes.coverage < minimumCoverage) {
      fail(`Coverage error: ${$red(`${report.nodes.coverage}%`)} does not meet minimum coverage ${$gry(`(${minimumCoverage}%)`)}`)
    }

    return files
  }
}

export function coverage(options: CoverageOptions): Coverage {
  return new Coverage(options)
}


type IgnoreCoverage = 'test' | 'if' | 'else' | 'try' | 'catch' | 'finally' | 'next'
const ignoreRegexp = /(coverage|istanbul)\s+ignore\s+(test|if|else|try|catch|finally|next)(\s|$)/g
