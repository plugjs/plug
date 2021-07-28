import { Files } from '../files'
import { install } from '../pipe'
import { parseOptions } from '../utils/options'

import type { Log } from '../utils/log'
import type { ParseOptions } from '../utils/options'
import type { Plug } from '../pipe'
import type { Run } from '../run'

import { createInstrumenter, InstrumenterOptions } from 'istanbul-lib-instrument'
import { parallelize } from '../utils/parallelize'
import { RawSourceMap } from 'source-map'
import { extname } from 'path/posix'
import { FilterOptions } from '../utils/filter'
import { FilePath } from '../utils/paths'

declare module '../pipe' {
  interface Pipe<P extends Pipe<P>> {
    instrument: PlugExtension<P, typeof InstrumentPlug>
  }
}

declare module '../task' {
  interface TaskCache {
    'istanbul.instrumented': FilePath[]
  }
}

/**
 * A subset of Istanbul's own instrumenter options.
 */
export interface InstrumentOptions extends Omit<FilterOptions, 'scriptsOnly'> {
  /**
   * Match original paths of files
   *
   * @default true
   */
   matchOriginalPaths?: boolean,

   /**
   * Preserve comments in instrumented code
   *
   * @default false
  */
  preserveComments?: boolean;

  /**
   * Generate compact code
   *
   * @default true
   */
  compact?: boolean;

  /**
   * Instrument ES6 modules
   *
   * @default false
   */
  esModules?: boolean;

  /**
   * Allow `return` statements outside of functions
   *
   * @default false
   */
  autoWrap?: boolean;
}

export class InstrumentPlug implements Plug {
  #args: ParseOptions<FilterOptions>
  #options: Partial<InstrumenterOptions>

  constructor(...args: ParseOptions<InstrumentOptions>) {
    const { globs, options } = parseOptions(args, { matchOriginalPaths: true })
    this.#args = [ ...globs, { ...options, scriptsOnly: true } ]
    this.#options = { ...options, produceSourceMap: true }
  }

  async process(input: Files, run: Run, log: Log): Promise<Files> {
    const time = log.start()
    const output = input.fork()
    const instrumented: FilePath[] = []

    // Remember the list of instrumented files in our cache
    run.cache['istanbul.instrumented'] = instrumented

    // Note to self: I tried to implement worker pools (using "piscina") but
    // the even with a pre-allocated 8-worker pool, the savings were not that
    // significant, from 2.5 to 2.2 seconds on our entire code base...
    const instrumenter = createInstrumenter(this.#options)
    await parallelize(input.filter(...this.#args), async (file) => {
      const path = file.absolutePath
      if (extname(path) !== '.js') return output.add(file)

      const time = log.start()
      const code = await file.contents()
      const fileSourceMap = await file.sourceMap()
      const rawSourceMap = await fileSourceMap?.produceSourceMap(path)
      return new Promise<void>((resolve, reject) => {
        instrumenter.instrument(code, path, (error, contents) => {
          if (error) return reject(error)
          log.trace(`Instrumented "${file.absolutePath}" in`, time)
          const originalFile = file.originalFile
          const sourceMap: RawSourceMap = instrumenter.lastSourceMap() as any
          output.add(path, { contents, sourceMap, originalFile })
          instrumented.push(path)
          resolve()
        }, rawSourceMap as any)
      })
    })

    log.debug('Instrumented', output.length, 'files in', time)
    return output
  }
}

export const instrument = install('instrument', InstrumentPlug)
