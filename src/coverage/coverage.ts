import { AbsolutePath, Files, resolveAbsolutePath } from '../files'
import { $p, log } from '../log'
import { Plug } from '../pipe'
import { Run } from '../run'

import { absoluteWalk } from '../utils/walk'
import { CoverageResult } from './analysis'
import { coverageReport } from './report'

export interface CoverageOptions {
  coverageDir: string,
}

export class Coverage implements Plug {

  constructor(options: CoverageOptions)
  constructor(private _options: CoverageOptions) {}

  async pipe(run: Run, files: Files): Promise<Files> {
    const coverageDir = resolveAbsolutePath(run.directory, this._options.coverageDir)
    const coverageFiles = absoluteWalk(coverageDir, [ 'coverage-*.json' ])

    const report = await coverageReport(files.absolutePaths(), coverageFiles)

    let max = 0
    for (const file in report) {
      if (file.length > max) max = file.length
    }

    log.info('Coverage report').sep()
    for (const [ _file, details ] of Object.entries(report)) {
      const file = _file as AbsolutePath // TODO: WHY OH WHY TYPESCRIPT??
      let pad = max - file.length
      log.info('-', $p(file), ''.padStart(pad, '*'), details.nodeCoverage)
    }

    return files
  }
}

export function coverage(options: CoverageOptions): Coverage {
  return new Coverage(options)
}


type IgnoreCoverage = 'test' | 'if' | 'else' | 'try' | 'catch' | 'finally' | 'next'
const ignoreRegexp = /(coverage|istanbul)\s+ignore\s+(test|if|else|try|catch|finally|next)(\s|$)/g
