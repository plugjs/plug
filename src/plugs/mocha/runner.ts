import RealMocha from 'mocha' // Mocha types pollute the global scope!
import { BuildFailure } from '../../failure'

import { Files } from '../../files'
import { $wht, NOTICE } from '../../log'
import { PipeParameters, Plug, Context } from '../../pipe'
import { MochaOptions } from '../mocha'
import { logSymbol, PlugReporter } from './reporter'

/** Writes some info about the current {@link Files} being passed around. */
export default class Mocha implements Plug<void> {
  constructor(...args: PipeParameters<'mocha'>)
  constructor(private readonly _options: MochaOptions = {}) {}

  async pipe(files: Files, context: Context): Promise<void> {
    // Enter log here, so that log messages called when loading files get
    // properly indented by our logger
    context.log.notice('') // empty line
    context.log.enter(NOTICE, $wht('Starting Mocha'))

    // Create the mocha runner
    const mocha = new RealMocha({
      diff: true, // by defaut enable diffs
      reporter: PlugReporter, // default to our reporter
      ...this._options, // override defaults with all other options
      reporterOptions: {
        ...this._options.reporterOptions,
        [logSymbol]: context.log, // always force a log
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
          if (failures) reject(new BuildFailure({ logged: true }))
          resolve(undefined)
        })
      } catch (error) {
        reject(error)
      }
    })
  }
}
