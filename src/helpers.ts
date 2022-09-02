import { assert } from './assert'
import { requireContext } from './async'
import { Files } from './files'
import { $p, log } from './log'
import { AbsolutePath, getCurrentWorkingDirectory, resolveDirectory, resolveFile } from './paths'
import { Pipe } from './pipe'
import { rm } from './utils/asyncfs'
import { ParseOptions, parseOptions } from './utils/options'
import { walk, WalkOptions } from './utils/walk'

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

  const context = requireContext()
  return new Pipe(context, async (): Promise<Files> => {
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
