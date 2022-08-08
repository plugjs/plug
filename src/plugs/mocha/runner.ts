import type { Files } from '../../files'
import type { AbsolutePath } from '../../paths'

import Mocha from 'mocha'

import { runAsync } from '../../async'
import { buildFailed, log, logOptions } from '../../log'
import { Plug } from '../../pipe'
import { Run, RunImpl } from '../../run'

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
      color: logOptions.colors, // ??? reporter option?
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

    for (const file of files.absolutePaths()) mocha.addFile(file)

    return new Promise((resolve, reject) => {
      try {
        mocha.run((failures) => {
          if (failures) {
            run.log.error('Mocha detected', failures, 'errors')
            reject(buildFailed)
          } else {
            resolve(undefined)
          }
        })
      } catch (error) {
        run.log.error('Mocha error', error)
        reject(buildFailed)
      }
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
    await new MochaRunner().pipe(files, run)
  })

  process.exit(0)
})
