import { assert } from '../assert'
import { Files } from '../files'
import { $p } from '../log'
import { assertAbsolutePath, getAbsoluteParent, resolveAbsolutePath } from '../paths'
import { install, PipeParameters } from '../pipe'
import { Plug, RunContext } from '../types'
import { chmod, copyFile, fsConstants, mkdir } from '../utils/asyncfs'

/** Options for copying files */
export interface CopyOptions {
  /** Whether to allow overwriting or not (default `false`). */
  overwrite?: boolean,
  /** If specified, use this `mode` (octal string) when creating files. */
  mode?: string | number,
  /** If specified, use this `mode` (octal string) when creating directories. */
  dirMode?: string | number,
  /** If specified, this function will be invoked to rename files. */
  rename?: (relative: string) => string
}

declare module '../pipe' {
  export interface Pipe {
    /**
     * Copy the curent {@link Files} to a different directory
     *
     * @param directory The target directory where files will be copied to
     */
    copy(directory: string): Pipe
    /**
     * Copy the curent {@link Files} to a different directory
     *
     * @param directory The target directory where files will be copied to
     * @param options Extra {@link CopyOptions | options} for the copy operation
     */
    copy(directory: string, options: CopyOptions): Pipe
  }
}

/* ========================================================================== *
 * INSTALLATION / IMPLEMENTATION                                              *
 * ========================================================================== */

/** Copy the curent {@link Files} to a different directory */
install('copy', class Copy implements Plug<Files> {
  constructor(...args: PipeParameters<'copy'>)
  constructor(
      private readonly _directory: string,
      private readonly _options: CopyOptions = {},
  ) {}

  async pipe(files: Files, run: RunContext): Promise<Files> {
    /* Destructure our options with some defaults and compute write flags */
    const { mode, dirMode, overwrite, rename = (s): string => s } = this._options
    const flags = overwrite ? fsConstants.COPYFILE_EXCL : 0
    const dmode = parseMode(dirMode)
    const fmode = parseMode(mode)

    /* Our files builder for all written files */
    const directory = run.resolve(this._directory)
    const builder = Files.builder(directory)

    /* Iterate through all the mappings of the source files */
    for (const [ relative, absolute ] of files.pathMappings()) {
      /* The target absolute is the (possibly) renamed relative source file
       * relocated to the the target directory */
      const target = resolveAbsolutePath(builder.directory, rename(relative))

      /* We never copy a file onto itself, but not fail either */
      if (target === absolute) {
        run.log.warn('Cowardly refusing to copy same file', $p(absolute))
        continue
      }

      /* Create the parent directory, recursively */
      const directory = getAbsoluteParent(target)
      const firstParent = await mkdir(directory, { recursive: true })

      /* Set the mode for all created directories */
      if (firstParent && (dmode !== undefined)) {
        assertAbsolutePath(firstParent)
        for (let dir = directory; ; dir = getAbsoluteParent(dir)) {
          run.log.trace(`Setting mode ${stringifyMode(dmode)} for directory`, $p(dir))
          await chmod(dir, dmode)
          if (dir === firstParent) break
        }
      }

      /* Actually _copy_ the file */
      run.log.trace(`Copying "${$p(absolute)}" to "${$p(target)}"`)
      await copyFile(absolute, target, flags)

      /* Set the mode, if we need to */
      if (fmode !== undefined) {
        run.log.trace(`Setting mode ${stringifyMode(fmode)} for file`, $p(target))
        await chmod(target, fmode)
      }

      /* Record this file */
      builder.add(relative)
    }

    const result = builder.build()
    run.log.info('Copied', result.length, 'files to', $p(builder.directory))
    return result
  }
})

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

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
