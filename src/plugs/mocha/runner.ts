import RealMocha from 'mocha' // Mocha types pollute the global scope!

import { failure } from '../../assert'
import { Files } from '../../files'
import { $wht, NOTICE } from '../../log'
import { PipeParameters } from '../../pipe'
import { Plug, RunContext } from '../../types'
import { MochaOptions } from '../mocha'
import { logSymbol, PlugReporter, runSymbol } from './reporter'

/** Writes some info about the current {@link Files} being passed around. */
export default class Mocha implements Plug<undefined> {
  constructor(...args: PipeParameters<'mocha'>)
  constructor(private readonly _options: MochaOptions = {}) {}

  async pipe(files: Files, run: RunContext): Promise<undefined> {
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
