import RealMocha from 'mocha' // Mocha types pollute the global scope!

import { assert } from '../../assert'
import { BuildFailure } from '../../failure'
import { $p, $wht, NOTICE } from '../../logging'
import { resolveFile } from '../../paths'
import { logSymbol, PlugReporter } from './reporter'

import type { Files } from '../../files'
import type { Context, PipeParameters, Plug } from '../../pipe'
import type { MochaOptions } from '../mocha'

/** Writes some info about the current {@link Files} being passed around. */
export default class Mocha implements Plug<void> {
  constructor(...args: PipeParameters<'mocha'>)
  constructor(private readonly _options: MochaOptions = {}) {}

  async pipe(files: Files, context: Context): Promise<void> {
    // Enter log here, so that log messages called when loading files get
    // properly indented by our logger
    context.log.notice('') // empty line
    context.log.enter(NOTICE, $wht('Starting Mocha'))

    // Expand our options
    const { require, ...options } = this._options

    // See if we require a setup script...
    if (require) {
      const requiredFile = context.resolve(require)
      const scriptFile = resolveFile(requiredFile)
      assert(scriptFile, `Mocha setup file ${$p(requiredFile)} not found`)
      context.log.debug(`Importing setup script ${$p(requiredFile)}`)
      await import(scriptFile)
    }

    // Create the mocha runner
    const mocha = new RealMocha({
      diff: true, // by defaut enable diffs
      reporter: PlugReporter, // default to our reporter
      ...options, // override defaults with all other options
      reporterOptions: {
        ...options.reporterOptions,
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
          if (failures) reject(BuildFailure.fail())
          resolve(undefined)
        })
      } catch (error) {
        reject(error)
      }
    })
  }
}
