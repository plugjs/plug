import { Files } from '../files'
import { $p, log } from '../log'
import { Plug } from '../pipe'
import { Run } from '../run'

export class Debug implements Plug {
  constructor() {
    // nothing to do
  }

  async pipe(files: Files, run: Run): Promise<Files> {
    log.info('Debugging', files.length, 'files')
    log.info('-        base dir:', $p(run.resolve('@')))
    log.info('-  build file dir:', $p(run.resolve('.')))
    log.info('-       files dir:', $p(files.directory))
    if (files.length) {
      const [ path, ...paths ] = [ ...files.absolutePaths() ]
      log.info('-           files:', $p(path))
      for (const p of paths) log.info('-                :', $p(p))
    }
    return files
  }
}

export function debug() {
  return new Debug()
}
