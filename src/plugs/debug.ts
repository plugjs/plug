import type { Files } from '../files'
import type { Run } from '../run'

import { $p, log } from '../log'
import { install, Plug } from '../pipe'

export class Debug implements Plug {
  constructor() {}

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

export const debug = install('debug', Debug)

declare module '../pipe' {
  export interface Pipe {
    debug: PipeExtension<typeof Debug>
  }
}
