import { assert, assertPromises } from './asserts'
import { requireContext } from './async'
import { Files } from './files'
import { rm } from './fs'
import { $p, log } from './logging'
import { commonPath, getCurrentWorkingDirectory, resolveDirectory, resolveFile } from './paths'
import { Pipe } from './pipe'
import { parseOptions } from './utils/options'
import { walk } from './utils/walk'

import type { AbsolutePath } from './paths'
import type { ParseOptions } from './utils/options'
import type { WalkOptions } from './utils/walk'

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
  return new Pipe(context, Promise.resolve().then(async () => {
    const directory = options.directory ?
      context.resolve(options.directory) :
      getCurrentWorkingDirectory()

    const builder = Files.builder(directory)
    for await (const file of walk(directory, globs, options)) {
      builder.add(file)
    }

    return builder.build()
  }))
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
 * Merge the results of several {@link Pipe}s into a single one.
 *
 * Merging is performed _in parallel_. When serial execution is to be desired,
 * we can merge the awaited _result_ of the {@link Pipe}.
 *
 * For example:
 *
 * ```
 * const pipe: Pipe = merge([
 *   await this.anotherTask1(),
 *   await this.anotherTask2(),
 * ])
 * ```
 */
export function merge(pipes: (Pipe | Files | Promise<Files>)[]): Pipe {
  const context = requireContext()
  return new Pipe(context, Promise.resolve().then(async () => {
    // No pipes? Just send off an empty pipe...
    if (pipes.length === 0) return Files.builder(getCurrentWorkingDirectory()).build()

    // Await for all pipes / files / files promises
    const results = await assertPromises<Files>(pipes)

    // Find the common directory between all the Files instances
    const [ firstDir, ...otherDirs ] = results.map((f) => f.directory)
    const directory = commonPath(firstDir!, ...otherDirs)

    // Build our new files instance merging all the results
    return Files.builder(directory).merge(...results).build()
  }))
}

/**
 * Create an empty _no-op_ {@link Pipe}.
 *
 * This is useful when creating tasks with conditional pipes and returning the
 * correct type, for example:
 *
 * ```
 * if (someCondition) {
 *   return find(...).pipe(...)
 * } else {
 *   return noop()
 * }
 * ```
 */
export function noop(): Pipe {
  const context = requireContext()
  const files = new Files(getCurrentWorkingDirectory())
  return new Pipe(context, Promise.resolve(files))
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
