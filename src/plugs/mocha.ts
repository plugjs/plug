import type { Files } from '../files'
import type { Run } from '../run'
import type { MochaMessage } from './mocha/runner'

import { fork } from 'node:child_process'

import { requireResolve } from '../paths'
import { install, Plug } from '../pipe'
import { $p, logOptions } from '../log'
import { failure } from '../assert'

export interface MochaOptions {
  /** Specify the directory where coverage data will be saved */
  coverageDir?: string,
  /** Bail after first test failure? */
  bail?: boolean,
  /** Show diff on failure? */
  diff?: boolean,
  /** Report tests without running them? */
  dryRun?: boolean,
  /** Tests marked `only` fail the suite? */
  forbidOnly?: boolean,
  /** Pending tests fail the suite? */
  forbidPending?: false,
  /** Reporter name. */
  reporter?: string
  /** Options for the reporter */
  reporterOptions?: Record<string, any>,
  /** Number of times to retry failed tests. */
  retries?: number,
  /** Slow threshold value. */
  slow?: number,
  /** Timeout threshold value. */
  timeout?: number,
}

export class Mocha implements Plug<undefined> {
  constructor(options?: MochaOptions)
  constructor(private readonly _xoptions: MochaOptions = {}) {}

  async pipe(files: Files, run: Run): Promise<undefined> {
    const { coverageDir, ...options } = this._xoptions

    /* Get our runner script */
    const script = requireResolve(__filename, './mocha/runner')

    /* Environment variables */
    const env = { ...process.env }
    env.LOG_OPTIONS = JSON.stringify(logOptions.fork(run.taskName))
    if (coverageDir) env.NODE_V8_COVERAGE = run.resolve(coverageDir)

    /* Run our script in a _separate_ process */
    const child = fork(script, {
      stdio: [ 'ignore', 'inherit', 'inherit', 'ipc' ],
      env,
    })

    run.log.debug('Mocha running', $p(script), `(pid=${child.pid})`)

    /* Return a promise from the child process events */
    return new Promise<undefined>((resolve, reject) => {
      child.on('error', (error) => reject(error))
      child.on('exit', (code, signal) => {
        if (code === 0) return resolve(undefined)
        if (code === 1) return reject(failure())
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
          options,
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
