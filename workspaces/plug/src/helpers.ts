import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BuildFailure, assert, assertPromises } from './asserts'
import { requireContext } from './async'
import { Files } from './files'
import { rm } from './fs'
import { $gry, $p, $plur, $wht, $ylw, log } from './logging'
import {
  commonPath,
  getAbsoluteParent,
  getCurrentWorkingDirectory,
  resolveDirectory,
  resolveFile,
} from './paths'
import { PipeImpl } from './pipe'
import { RunBuild } from './plugs/build'
import { JsoncError, parseJsonc } from './utils'
import { execChild } from './utils/exec'
import { parseOptions } from './utils/options'
import { walk } from './utils/walk'

import type { Pipe } from './index'
import type { AbsolutePath } from './paths'
import type { Context } from './pipe'
import type { RunBuildOptions } from './plugs/build'
import type { ExecChildOptions } from './utils/exec'
import type { ParseOptions } from './utils/options'
import type { WalkOptions } from './utils/walk'

/* ========================================================================== *
 * EXTERNAL HELPERS                                                           *
 * ========================================================================== */

/**
 * The {@link UsingOptions} interface defines the options for building
 * {@link Files} instances from a static list of paths.
 */
export interface UsingOptions {
  /**
   * The directory the {@link Files} instance will be rooted into (defaults to
   * the _current working directory_).
   */
  directory?: string
}

/** The {@link FindOptions} interface defines the options for finding files. */
export interface FindOptions extends WalkOptions {
  /** The directory where to start looking for files. */
  directory?: string
}

/** Return the current execution {@link Context} */
export function context(): Context {
  return requireContext()
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
  return new PipeImpl(context, Promise.resolve().then(async () => {
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

export type InvokeBuildOptions = RunBuildOptions & Record<string, string>
export type InvokeBuildTasks = string | [ string, ...string[] ]

export function invokeBuild(buildFile: string): Promise<void>
export function invokeBuild(buildFile: string, task: string): Promise<void>
export function invokeBuild(buildFile: string, task: string, options: InvokeBuildOptions): Promise<void>
export function invokeBuild(buildFile: string, tasks: [ string, ...string[] ]): Promise<void>
export function invokeBuild(buildFile: string, tasks: [ string, ...string[] ], options: InvokeBuildOptions): Promise<void>
export function invokeBuild(buildFile: string, options: InvokeBuildOptions): Promise<void>
export async function invokeBuild(
    buildFile: string,
    tasksOrOptions?: string | [ string, ...string[] ] | InvokeBuildOptions,
    maybeOptions?: InvokeBuildOptions,
): Promise<void> {
  const [ tasks, options = {} ] =
      typeof tasksOrOptions === 'string' ?
        [ [ tasksOrOptions ], maybeOptions ] :
        Array.isArray(tasksOrOptions) ?
          [ tasksOrOptions, maybeOptions ] :
          typeof tasksOrOptions === 'object' ?
            [ [ 'default' ], tasksOrOptions ] :
            [ [ 'default' ], {} ]

  if (tasks.length === 0) tasks.push('default')

  const { coverageDir, forceModule, ...props } = options
  const forkOptions = { coverageDir, forceModule }

  const context = requireContext()
  const file = context.resolve(buildFile)
  const dir = getAbsoluteParent(file)
  const files = Files.builder(dir).add(file).build()

  return new RunBuild(tasks, props, forkOptions)
      .pipe(files, context)
      .then(() => void 0)
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

  /* coverage ignore if */
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
  return new PipeImpl(context, Promise.resolve().then(async () => {
    // No pipes? Just send off an empty pipe...
    if (pipes.length === 0) return new Files()

    // Await for all pipes / files / files promises
    const awaited = await assertPromises<Files>(pipes)
    const results = awaited.filter((result) => result.length)

    // No files in anything to be merged? Again send off an empty pipe...
    if (results.length === 0) return new Files()

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
  return new PipeImpl(context, Promise.resolve(new Files()))
}

/**
 * Create a {@link Pipe} from a static set of files.
 *
 * The default directory where the {@link Files} instance will be rooted into
 * is the _current working directory_.
 *
 * If _relative_ each file specified will be resolved relatively to the base
 * {@link Files} directory.
 */
export function using(...args: [ ...string[] ]): Pipe
export function using(...args: [ ...string[], options: UsingOptions ]): Pipe
export function using(...args: ParseOptions<UsingOptions>): Pipe {
  const { options, params } = parseOptions(args, { directory: '.' })

  const context = requireContext()
  const directory = context.resolve(options.directory)

  const files = Files.builder(directory).add(...params).build()
  return new PipeImpl(context, Promise.resolve(files))
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

/**
 * Create a temporary directory and return its {@link AbsolutePath}.
 *
 * The directory will be rooted in `/tmp` or wherever `os.tmpdir()` decides.
 */
export function mkdtemp(): AbsolutePath {
  const prefix = join(tmpdir(), 'plugjs-')
  const path = mkdtempSync(prefix)
  return resolve(path)
}

/**
 * Execute a command and await for its result from within a task.
 *
 * For example:
 *
 * ```
 * import { exec } from '@plugjs/plugjs'
 *
 * export default build({
 *   async runme() {
 *     await exec('ls', '-la', '/')
 *     // or similarly letting the shell interpret the command
 *     await exec('ls -la /', { shell: true })
 *   },
 * })
 * ```
 *
 * @param cmd The command to execute
 * @param args Any additional argument for the command to execute
 * @param options Extra {@link ExecChildOptions | options} for process execution
 */
export function exec(
    cmd: string,
    ...args: [ ...args: string[] ] | [ ...args: string[], options: ExecChildOptions ]
): Promise<void> {
  const { params, options } = parseOptions(args)
  return execChild(cmd, params, options, requireContext())
}

/**
 * Read and parse a JSON/JSONC file, throwing an error if not found.
 *
 * @params file The JSON file to parse
 */
export function parseJson(file: string, strict: boolean = false): any {
  const jsonFile = requireContext().resolve(file)
  let jsonText: string
  try {
    jsonText = readFileSync(jsonFile, 'utf-8')
  } catch (error: any) {
    if (error.code === 'ENOENT') log.fail(`File ${$p(jsonFile)} not found`)
    if (error.code === 'EACCES') log.fail(`File ${$p(jsonFile)} can not be accessed`)
    log.fail(`Error reading ${$p(jsonFile)}`, error)
  }

  try {
    return parseJsonc(jsonText, {
      disallowComments: strict,
      allowTrailingComma: ! strict,
    })
  } catch (error) {
    if (error instanceof JsoncError) {
      const errors = error.errors
      log.error(`Found ${$plur(errors.length, 'error', 'errors')} parsing ${$p(jsonFile)}`)
      for (const e of errors) {
        log.error(`  ${$wht(e.code)} ${$gry('at line')} ${$ylw(e.line)}${$gry(', column')} ${$ylw(e.column)}`)
      }

      throw new BuildFailure()
    } else throw error
  }
}
