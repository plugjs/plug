import type { BuildContext, ThisBuild } from './build'
import type { Task } from './task'

import { $t, log, Logger, TaskLogger } from './log'
import { AbsolutePath, isAbsolutePath, resolveAbsolutePath } from './paths'
import { Files, FilesBuilder } from './files'
import { ParseOptions, parseOptions } from './utils/options'
import { Pipe, Plug, PlugFunction } from './pipe'
import { assert, assertSettled, fail } from './assert'
import { currentRun, runAsync } from './async'
import { walk, WalkOptions } from './utils/walk'
import { join } from 'node:path'

/** The {@link FindOptions} interface defines the options for finding files. */
export interface FindOptions extends WalkOptions {
  /**
   * The directory where to start looking for files according to the rules
   * specified in {@link Run.resolve}.
   */
  directory?: string
}

/**
 * The {@link Run} interface defines the context in which a {@link Task} is
 * invoked.
 *
 * Runs keep track of the invocation stack (to avoid circular dependencies) and
 * of the cached results for {@link Task} invocations.
 */
export interface Run extends BuildContext {
  /**
   * The _base directory_ associated with the run - normally the directory
   * where the initial build files is located.
   */
  readonly baseDir: AbsolutePath,

  /**
   * The {@link Logger} associated with this instance.
   */
  readonly log: Logger

  /**
   * The _name_ of the task associated with this {@link Run} (if one is).
   *
   * Tasks can have different names in different builds, this refers to the
   * _task name_ in the build being executed.
   */
  readonly taskName?: string

  /** Call another {@link Task} from this one. */
  call(name: string): Promise<Files | void>

  /**
   * Resolve a path in the context of this {@link Run}.
   *
   * If the path starts with `@...` it is considered to be relative to this
   * instance's `baseDir`, otherwise it will be resolved against the build file
   * where the task was _originally_ defined in.
   */
  resolve(...paths: string[]): AbsolutePath

  /**
   * Create a {@link FilesBuilder} instancce resolving the directory specified
   * according to the rules specified in {@link Run.resolve}.
   */
  files(...paths: string[]): FilesBuilder

  /**
   * Find files according to the globs and {@link FindOptions specified}.
   */
  find(glob: string, ...args: ParseOptions<FindOptions>): Pipe
}

/** Default implementation of the {@link Run} interface. */
class RunImpl implements Run {
  private readonly _pipes: Pipe[] = []
  readonly log: Logger

  constructor(
      readonly baseDir: AbsolutePath,
      readonly buildDir: AbsolutePath,
      readonly buildFile: AbsolutePath,
      readonly tasks: Readonly<Record<string, Task>>,
      private readonly _cache: Map<Task, Promise<Files | void>>,
      private readonly _stack: readonly Task[],
      readonly taskName?: string,
  ) {
    this.log = new TaskLogger(taskName || '')
  }

  call(name: string): Promise<Files | void> {
    const task = this.tasks[name]
    if (! task) fail(`Task "${$t(name)}" does not exist`)

    /* Check for circular dependencies */
    assert(! this._stack.includes(task), `Circular dependency running task "${$t(name)}"`)

    /* Check for cached results */
    const cached = this._cache.get(task)
    if (cached) return cached

    const childRun = new RunImpl(
        this.baseDir, // the "baseDir" for "@" resolutuion is always unchanged, from the original build file or arg
        task.context.buildDir, // the "buildDir" and "buildFile", used for local resolution (e.g. "./foo.bar") are
        task.context.buildFile, // always the ones associated with the build where the task was defined
        { ...task.context.tasks, ...this.tasks }, // merge the tasks, starting from the ones of the original build
        this._cache, // the cache is a singleton within the whole Run tree, it's passed unchanged
        [ ...this._stack, task ], // the stack gets added the task being run...
        name,
    )

    /* Actually _call_ the `Task` and get a promise for it */
    const promise = runAsync(childRun, name, () => childRun.run(task))

    /* Cache the execution promise (never run the smae task twice) */
    this._cache.set(task, promise)
    return promise
  }

  async run(task: Task): Promise<Files | void> {
    const now = Date.now()
    log.sep().info('Starting task').sep()

    const thisRun = this
    const thisBuild: ThisBuild<any> = {}

    for (const name in this.tasks) {
      thisBuild[name] = (): Pipe => {
        const pipe = this.call(name) as Pipe

        pipe.plug = function plug(arg: Plug | PlugFunction): Pipe {
          const plug = typeof arg === 'function' ? { pipe: arg } : arg
          const start = pipe.then((files: Files | undefined) => {
            assert(files, `Task ${$t(name)} did not return any files to pipe`)
            return plug.pipe(files, thisRun)
          })
          return new Pipe(start, thisRun)
        }

        this._pipes.push(pipe)
        return pipe
      }
    }

    try {
      let result: Files | void
      try {
        result = await task.call(thisBuild, this)
      } finally {
        const settlements = await Promise.allSettled(this._pipes)
        assertSettled(settlements, 'Task failed in', Date.now() - now, 'ms')
      }

      log.sep().info('Task completed in', Date.now() - now, 'ms').sep()
      return result
    } catch (error) {
      fail('Task failed in', Date.now() - now, 'ms', error)
    }
  }

  resolve(...paths: string[]): AbsolutePath {
    const path = join(...paths)
    if (! path) return this.buildDir

    if (path.startsWith('@')) {
      const relative = path.substring(1)
      assert(! isAbsolutePath(relative), `Path component of "${path}" is absolute`)
      return resolveAbsolutePath(this.baseDir, relative)
    }

    if (isAbsolutePath(path)) return path

    return resolveAbsolutePath(this.buildDir, path)
  }

  files(...paths: string[]): FilesBuilder {
    return Files.builder(this.resolve(...paths))
  }

  find(glob: string, ...args: ParseOptions<FindOptions>): Pipe {
    const promise = Promise.resolve().then(async () => {
      const { params, options: { directory, ...options } } = parseOptions(args, {})
      const dir = this.resolve(directory || '.')

      const builder = Files.builder(dir)
      for await (const file of walk(dir, [ glob, ...params ], options)) {
        builder.add(file)
      }

      return builder.build()
    })

    const pipe = new Pipe(promise, this)
    this._pipes.push(pipe)
    return pipe
  }
}

/**
 * Create a new {@link Run} associated with the given {@link BuildContext} and
 * (optionally) forcing its {@link Run.baseDir baseDir} to the one specified.
 */
export function initRun(context: BuildContext, baseDir?: AbsolutePath): Run {
  return new RunImpl(
      baseDir || context.buildDir,
      context.buildDir,
      context.buildFile,
      context.tasks,
      new Map<Task, Promise<Files | void>>(),
      [],
  )
}

/**
 * Find files according to the globs and {@link FindOptions specified}.
 */
export function find(glob: string, ...args: ParseOptions<FindOptions>): Pipe {
  const run = currentRun()
  assert(run, 'Unable to find files outside a running task')
  return run.find(glob, ...args)
}

/**
 * Resolve a path into an {@link AbsolutePath}.
 *
 * If the path starts with `@...` it is considered to be relative to this
 * instance's `baseDir`, otherwise it will be resolved against the build file
 * where the task was _originally_ defined in.
 */
export function resolve(...paths: string[]): AbsolutePath {
  const run = currentRun()
  assert(run, 'Unable to find files outside a running task')
  return run.resolve(...paths)
}
