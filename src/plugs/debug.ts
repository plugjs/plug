import { Files } from '../files'
import { $p, log } from '../log'
import { Plug } from '../pipe'
import { Run } from '../run'

export class Debug implements Plug {
  constructor() {
    // nothing to do
  }
  pipe(run: Run, files: Files): Files | Promise<Files> {

    log.info('Debugging', files.length, 'files')
    log.info('-   run directory:', $p(run.directory))
    log.info('- files directory:', $p(files.directory))
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
