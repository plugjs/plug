import { assert } from './assert'
import { requireContext } from './async'
import { Files } from './files'
import { $p, log } from './log'
import { AbsolutePath, commonPath, getCurrentWorkingDirectory, resolveDirectory, resolveFile } from './paths'
import { Context, Pipe, Plug, PlugFunction, PlugResult } from './pipe'
import { rm } from './utils/asyncfs'
import { ParseOptions, parseOptions } from './utils/options'
import { walk, WalkOptions } from './utils/walk'

/* ========================================================================== *
 * INTERNAL SIMPLE PIPE IMPLEMENTATION                                        *
 * ========================================================================== */

class PipeImpl extends Pipe implements Pipe {
  constructor(private readonly _start: (context: Context) => Promise<Files>) {
    super()
  }

  plug(plug: Plug<Files>): Pipe
  plug(plug: PlugFunction<Files>): Pipe
  plug(plug: Plug<void | undefined>): Promise<undefined>
  plug(plug: PlugFunction<void | undefined>): Promise<undefined>
  plug(arg: Plug<PlugResult> | PlugFunction<PlugResult>): Pipe | Promise<undefined> {
    const plug = typeof arg === 'function' ? { pipe: arg } : arg

    const parent = this
    return new PipeImpl(async (context: Context): Promise<Files> => {
      const files = await parent._start(context)
      const files2 = await plug.pipe(files, context)
      assert(files2, 'Unable to extend pipe (part tres)')
      return files2
    })
  }

  async run(): Promise<Files> {
    return this._start(requireContext())
  }
}

/* ========================================================================== *
 * EXTERNAL HELPERS                                                           *
 * ========================================================================== */

/** The {@link FindOptions} interface defines the options for finding files. */
export interface FindOptions extends WalkOptions {
  /** The directory where to start looking for files. */
  directory?: string
}

/** Find files in the current directory using the specified _glob_. */
export function find(glob: string): Pipe
/** Find files in the current directory using the specified _globs_. */
export function find(glob: string, ...globs: string[]): Pipe
/** Find files using the specified _glob_ and {@link FindOptions | options}. */
export function find(glob: string, options: FindOptions): Pipe
/** Find files using the specified _globs_ and {@link FindOptions | options}. */
export function find(glob: string, ...extra: [...globs: string[], options: FindOptions]): Pipe
/* Overload */
export function find(...args: ParseOptions<FindOptions>): Pipe {
  const { params: globs, options } = parseOptions(args, {})

  return new PipeImpl(async (context: Context): Promise<Files> => {
    const directory = options.directory ?
      context.resolve(options.directory) :
      getCurrentWorkingDirectory()

    const builder = Files.builder(directory)
    for await (const file of walk(directory, globs, options)) {
      builder.add(file)
    }

    return builder.build()
  })
}

/**
 * Merge the results of several {@link Pipe}s into a single one.
 *
 * Merging is performed _in parallel_. When serial execution is to be desired,
 * we can merge the awaited _result_ of the {@link Pipe}'s `run()` call.
 *
 * For example:
 *
 * ```
 * const pipe: Pipe = merge([
 *   await this.find_sources().run(),
 *   await this.find_tests().run(),
 * ])
 * ```
 */
export function merge(pipes: (Pipe | Files | Promise<Files>)[]): Pipe {
  return new PipeImpl(async (): Promise<Files> => {
    if (pipes.length === 0) return Files.builder(getCurrentWorkingDirectory()).build()

    const [ first, ...other ] = await Promise.all(pipes.map((pipe) => {
      return 'run' in pipe ? pipe.run() : pipe
    }))

    const firstDir = first.directory
    const otherDirs = other.map((f) => f.directory)

    const directory = commonPath(firstDir, ...otherDirs)

    return Files.builder(directory).merge(first, ...other).build()
  })
}

/**
 * Recursively remove the specified directory _**(use with care)**_.
 */
export async function rmrf(directory: string): Promise<void> {
  const context = requireContext()
  const dir = context.resolve(directory)

  assert(dir !== getCurrentWorkingDirectory(),
      `Cowardly refusing to wipe current working directory ${$p(dir)}`)

  assert(dir !== context.resolve('@'),
      `Cowardly refusing to wipe build file directory ${$p(dir)}`)

  if (! resolveDirectory(dir)) {
    log.info('Directory', $p(dir), 'not found')
    return
  }

  log.notice('Removing directory', $p(dir), 'recursively')
  await rm(dir, { recursive: true })
}

/**
 * Resolve a (set of) path(s) into an {@link AbsolutePath}.
 *
 * If the path (or first component thereof) starts with `@...`, then the
 * resolved path will be relative to the directory containing the build file
 * where the current task was defined, otherwise it will be relative to the
 * current working directory.
 */
export function resolve(...paths: [ string, ...string[] ]): AbsolutePath {
  return requireContext().resolve(...paths)
}

/**
 * Return an absolute path of the file if it exist on disk.
 *
 * See the comments on {@link resolve} to understand how paths are resolved.
 */
export function isFile(...paths: [ string, ...string[] ]): AbsolutePath | undefined {
  const path = requireContext().resolve(...paths)
  return resolveFile(path)
}

/**
 * Return an absolute path of the directory if it exist on disk.
 *
 * See the comments on {@link resolve} to understand how paths are resolved.
 */
export function isDirectory(...paths: [ string, ...string[] ]): AbsolutePath | undefined {
  const path = requireContext().resolve(...paths)
  return resolveDirectory(path)
}
