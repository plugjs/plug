import { extname } from 'path'
import { install } from '../pipe'
import { parallelize } from '../utils/parallelize'
import { ParseOptions, parseOptions } from '../utils/options'
import { runMocha } from '../detached/mocha'
import { writeSourceMap } from '../files/sourcemap'

import type { FilePath } from '../utils/paths'
import type { Files } from '../files'
import type { Log } from '../utils/log'
import type { MochaOptions as Options } from 'mocha'
import type { Plug } from '../pipe'
import type { Run } from '../run'
import type { FilterOptions } from '../utils/filter'
import type { CoverageMapData } from 'istanbul-lib-coverage'

/* ========================================================================== *
 * MOCHA PLUG                                                                 *
 * ========================================================================== */

declare module '../pipe' {
  interface Pipe<P extends Pipe<P>> {
    mocha: PlugExtension<P, typeof MochaPlug>
  }
}

declare module '../task' {
  interface TaskCache {
    'istanbul.coverage': CoverageMapData
  }
}

export interface MochaOptions extends Omit<FilterOptions, 'scriptsOnly'>, Options {
  /**
   * Match original paths of files.
   *
   * @default true
   */
   matchOriginalPaths?: boolean,

   /**
    * The reporter to use.
    *
    * Note that no matter what you chose here, no report will be emitted if
    * the logging level is set to `QUIET`.
    *
    * @default 'spec'
    */
   reporter?: string,
}

export class MochaPlug implements Plug {
  #args: ParseOptions<FilterOptions>
  #options: Options

  constructor(...args: ParseOptions<MochaOptions>) {
    const { globs, options } = parseOptions(args, {
      matchOriginalPaths: true,
      reporter: 'spec',
    })
    this.#args = [ ...globs, { ...options, scriptsOnly: true } ]
    this.#options = options
  }

  // A simple wrapper to `runMocha(...)` in our detached runners for testing!
  // istanbul ignore next - we don't write to disk in our plugfile so fork will fail!
  protected runMocha(...args: Parameters<typeof runMocha>): ReturnType<typeof runMocha> {
    return runMocha(...args)
  }

  async process(input: Files, run: Run, log: Log): Promise<Files> {
    const time = log.start()

    // We can only run ".js" files, so let's start filtering stuff out...
    const tests = new Set<FilePath>()
    for (const file of input.filter(...this.#args)) tests.add(file.absolutePath)

    // Fail if we can't find any test file...
    if (! tests.size) run.fail('No test files found')

    // Prepare our files with source maps
    const files = new Map<FilePath, string>()
    await parallelize(input, async (file) => {
      if (extname(file.absolutePath) !== '.js') return
      const outputs = await writeSourceMap(file.absolutePath, file, {
        sourceMaps: 'inline', // inline source maps, easier for node to find them
        combineSourceMaps: true, // produce combined source maps for mocha
      }) // default, inline!
      for (const [ path, contents ] of outputs) files.set(path, contents)
    })

    // Let mocha run, and capture failures and coverage data
    const { failures, coverage } = await this.runMocha({ files: files, tests, options: this.#options })

    // Keep coverage data in our task cache
    run.cache['istanbul.coverage'] = coverage

    // Check for failures
    if (failures) run.fail(`Mocha detected ${failures} test ${failures > 1 ? 'failures' : 'failure'}`)
    log.debug('Mocha processed', tests.size, 'test files in', time)
    return input
  }
}

export const mocha = install('mocha', MochaPlug)
