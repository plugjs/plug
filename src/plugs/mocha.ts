import type { Files } from '../files'
import type { Run } from '../run'

import { fork } from 'node:child_process'

import { requireResolve } from '../paths'
import { install, Plug } from '../pipe'
import { logOptions } from '../log'
import type { MochaMessage } from './mocha/runner'

export class Mocha implements Plug<undefined> {
  constructor() {}

  async pipe(files: Files, run: Run): Promise<undefined> {
    /* Get our runner script */
    const script = requireResolve(__filename, './mocha/runner')

    /* Run our script in a _separate_ process */
    const LOG_OPTIONS = JSON.stringify(logOptions.fork(run.taskName))
    const child = fork(script, {
      stdio: [ 'ignore', 'inherit', 'inherit', 'ipc' ],
      env: { ...process.env, LOG_OPTIONS },
    })

    /* Return a promise from the child process events */
    return new Promise<undefined>((resolve, reject) => {
      child.on('error', (error) => reject(error))
      child.on('exit', (code, signal) => {
        if (code === 0) return resolve(undefined)
        if (signal) return reject(new Error(`Child process exited with signal ${signal}`))
        if (code) return reject(new Error(`Child process exited with code ${code}`))
        reject(new Error('Child process failed for an unknown reason'))
      })

      /* After the handlers have been setup, send the message */
      try {
        const message: MochaMessage = {
          taskName: run.taskName,
          buildDir: run.buildDir,
          buildFile: run.buildFile,
          filesDir: files.directory,
          files: [ ...files.absolutePaths() ],
        }
        child.send(message)
      } catch (error) {
        reject(error)
      }
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
