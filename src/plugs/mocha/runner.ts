import type { Files } from '../../files'
import { Run, RunImpl } from '../../run'

import Mocha from 'mocha'

import { buildFailed, log, logOptions } from '../../log'
import { Plug } from '../../pipe'
import type { AbsolutePath } from '../../paths'
import { runAsync } from '../../async'

/** Worker data, from main thread to worker thread */
export interface MochaMessage {
  /** Task name (for logs) */
  taskName: string,
  /** Build file name */
  buildFile: AbsolutePath
  /** Build directory */
  buildDir: AbsolutePath,
  /** Files directory */
  filesDir: AbsolutePath,
  /** All files to pipe */
  files: AbsolutePath[],
}

/** Writes some info about the current {@link Files} being passed around. */
class MochaRunner implements Plug<undefined> {
  constructor() {}

  async pipe(files: Files, run: Run): Promise<undefined> {
    const mocha = new Mocha({
      allowUncaught: false,
      bail: false, // expose
      color: logOptions.colors,
      delay: false,
      diff: true, // expose
      dryRun: false, // expose
      forbidOnly: false, // expose
      forbidPending: false, // expose
      fullTrace: true, // expose
      inlineDiffs: true, // expose ??? reporter option?
      noHighlighting: false, // expose ??? reporter option?
      retries: 1, // expose
      // slow: ??? expose
      // timeout: ??? expose
      // TODO: reporter (our reporter)
    })

    run.log.notice('HERE 1')

    for (const file of files.absolutePaths()) {
      mocha.addFile(file)
    }

    run.log.notice('HERE 2')

    return new Promise((resolve, reject) => {
      run.log.notice('HERE 3')
      try {
        mocha.run((failures) => {
          run.log.notice('HERE 5', failures)
          if (failures) {
            run.log.error('Mocha detected', failures, 'errors')
            reject(buildFailed)
          } else {
            resolve(undefined)
          }
        })
      } catch (error) {
        run.log.error('Mocha error', error)
      }
      run.log.notice('HERE 4')
    })
  }
}

/* ========================================================================== *
 * RUNNER STARTUP                                                             *
 * ========================================================================== */

process.on('message', async (message: MochaMessage) => {
  log.warn('Child received message', message)

  const run = new RunImpl({
    buildDir: message.buildDir,
    buildFile: message.buildFile,
    taskName: message.taskName,
  })

  const files = run.files(message.filesDir).add(...message.files).build()

  await runAsync(run, message.taskName, async () => {
    run.log.notice('STARTING')
    await new MochaRunner().pipe(files, run)
    run.log.notice('FINISHED')
  })

  process.exit(0)
})
