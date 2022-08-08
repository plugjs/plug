import type { Files } from '../files'
import type { Run } from '../run'

import { fork } from 'node:child_process'

import { requireResolve } from '../paths'
import { install, Plug } from '../pipe'
import { logOptions } from '../log'

export class Mocha implements Plug<undefined> {
  constructor() {}

  async pipe(files: Files, run: Run): Promise<undefined> {
    const script = requireResolve(__filename, './mocha/runner')

    void files, run

    const LOG_OPTIONS = JSON.stringify(logOptions.fork(run.taskName))

    const child = fork(script, {
      stdio: [ 'ignore', 'inherit', 'inherit', 'ipc' ],
      env: { ...process.env, LOG_OPTIONS },
    })

    child.send({
      filesDir: files.directory,
      files: [ ...files.absolutePaths() ],
    })

    // Return our promise from the spawn events
    return new Promise<undefined>((resolve, reject) => {
      child.on('error', (error) => reject(error))
      child.on('exit', (code, signal) => {
        if (code === 0) return resolve(undefined)
        if (signal) return reject(new Error(`Child process exited with signal ${signal}`))
        if (code) return reject(new Error(`Child process exited with code ${code}`))
        reject(new Error('Child process failed for an unknown reason'))
      })
    })
  }
}

/* ========================================================================== *
 * INSTALLATION                                                               *
 * ========================================================================== */

install('mocha', Mocha)

declare module '../pipe' {
  export interface Pipe {
    mocha: PipeExtension<typeof Mocha>
  }
}
