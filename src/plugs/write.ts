import path from 'path'
import fs from '../utils/asyncfs'

import { Files } from '../files'
import { log, $p } from '../log'
import type { Plug } from '../pipe'
import type { Run } from '../run'
import assert from 'assert'

export interface WriteOptions {
  overwrite?: boolean,
  mode?: string | number,
  dirMode?: string | number,
  rename?: (relative: string) => string
}

export class Write implements Plug {
  #options: WriteOptions
  #directory: string

  constructor(directory: string, options: WriteOptions = {}) {
    this.#directory = directory
    this.#options = options
  }

  async pipe(run: Run, files: Files): Promise<Files> {
    /* Destructure our options with some defaults and compute write flags */
    const { mode, dirMode, overwrite, rename = (s) => s } = this.#options
    const flags = overwrite ? fs.constants.COPYFILE_EXCL : 0
    const dmode = parseMode(dirMode)
    const fmode = parseMode(mode)

    /* Our files builder for all written files */
    const builder = Files.builder(run, this.#directory)

    /* Iterate through all the mappings of the source files */
    for (const [ relative, absolute ] of files.pathMappings()) {
      /* The target absolute is the (possibly) renamed relative source file
       * relocated to the the target directory */
      const target = path.resolve(builder.directory, rename(relative))

      /* We never copy a file onto itself, but not fail either */
      if (target === absolute) {
        log.warn('Cowardly refusing to copy same file', $p(absolute))
        continue
      }

      /* Create the parent directory, recursively */
      const directory = path.dirname(target)
      const first = await fs.mkdir(directory, { recursive: true })
      if (first) {
        log.trace(`Directory ${$p(first)} created`)
        if (dmode !== undefined) {
          for (let dir = directory; ; dir = path.dirname(dir)) {
            log.trace(`Setting mode ${stringifyMode(dmode)} for dir`, $p(dir))
            await fs.chmod(dir, dmode)
            if (dir === first) break
          }
        }
      }

      log.trace(`Copying "${absolute}" to "${target}"`)
      await fs.copyFile(absolute, target, flags)

      if (fmode !== undefined) {
        log.trace(`Setting mode ${stringifyMode(fmode)} for file`, $p(target))
        await fs.chmod(target, fmode)
      }

      builder.add(relative)
    }

    const result = builder.build()
    log.info('Copied', result.length, 'files to', $p(builder.directory))

    return builder.build()
  }

}

export function write(directory: string, options?: WriteOptions) {
  return new Write(directory, options)
}

function parseMode(mode: string | number | undefined): number | undefined {
  if (mode === undefined) return undefined
  if (typeof mode === 'number') return mode
  const parsed = parseInt(mode, 8)
  assert(! isNaN(parsed), `Invalid mode "${mode}"`)
  return parsed
}

function stringifyMode(mode: number): string {
  return mode.toString(8).padStart(4, '0')
}
