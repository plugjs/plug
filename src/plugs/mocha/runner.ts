import type { Files } from '../../files'
import type { Plug } from '../../pipe'

import RealMocha from 'mocha' // Mocha types pollute the global scope!

import { failure } from '../../assert'
import { $wht, NOTICE } from '../../log'
import { Run } from '../../run'
import { logSymbol, PlugReporter, runSymbol } from './reporter'

/** Options to construct our {@link Mocha} plug. */
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

/** Writes some info about the current {@link Files} being passed around. */
export class Mocha implements Plug<undefined> {
  constructor(private readonly _options: MochaOptions) {}

  async pipe(files: Files, run: Run): Promise<undefined> {
    // Enter log here, so that log messages called when loading files get
    // properly indented by our logger
    run.log.notice('') // empty line
    run.log.enter(NOTICE, $wht('Starting Mocha'))

    // Create the mocha runner
    const mocha = new RealMocha({
      diff: true, // by defaut enable diffs
      reporter: PlugReporter, // default to our reporter
      ...this._options, // override defaults with all other options
      reporterOptions: {
        ...this._options.reporterOptions,
        [logSymbol]: run.log, // always force a log
        [runSymbol]: run, // always force a run
      },
      allowUncaught: false, // never allow uncaught exceptions
      delay: false, // never delay running
    })

    // Tell mocha about all our files
    for (const file of files.absolutePaths()) mocha.addFile(file)

    await mocha.loadFilesAsync()

    // Run mocha!
    return new Promise((resolve, reject) => {
      try {
        mocha.run((failures) => {
          if (failures) reject(failure())
          resolve(undefined)
        })
      } catch (error) {
        reject(error)
      }
    })
  }
}
