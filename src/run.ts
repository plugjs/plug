import type { BuildContext, ThisBuild } from './build'
import type { Task } from './task'

import { join } from 'node:path'
import { assert } from './assert'
import { runAsync } from './async'
import { Files, FilesBuilder } from './files'
import { $t, buildFailed, getLogger, Logger } from './log'
import { AbsolutePath, getCurrentWorkingDirectory, isAbsolutePath, resolveAbsolutePath } from './paths'
import { Pipe, PipeImpl } from './pipe'
import { ParseOptions, parseOptions } from './utils/options'
import { walk, WalkOptions } from './utils/walk'

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
  call(name: string): Promise<Files | undefined>

  /**
   * Resolve a path in the context of this {@link Run}.
   *
   * If the path starts with `@...` it is considered to be relative to the
   * {@link process.cwd | current working directory}, otherwise it will be
   * resolved against the build file where the task was originally defined in.
   */
  resolve(...paths: string[]): AbsolutePath

  /**
   * Create a {@link FilesBuilder} instancce resolving the directory specified
   * according to the rules specified in {@link Run.resolve}.
   */
  files(...paths: string[]): FilesBuilder

  /**
   * Find files according to the globs and {@link FindOptions} specified.
   */
  find(glob: string, ...args: ParseOptions<FindOptions>): Pipe & Promise<Files>

  /**
   * Create a new {@link Pipe} wrapping the specified {@link Files}.
   */
  pipe(files: Files | Promise<Files>): Pipe & Promise<Files>
}

/** Default implementation of the {@link Run} interface. */
class RunImpl implements Run {
  readonly log: Logger

  constructor(
      readonly buildDir: AbsolutePath,
      readonly buildFile: AbsolutePath,
      readonly tasks: Readonly<Record<string, Task>>,
      private readonly _cache: Map<Task, Promise<Files | undefined>>,
      private readonly _stack: readonly Task[],
      readonly taskName?: string,
  ) {
    this.log = getLogger(taskName)
  }

  call(name: string): Promise<Files | undefined> {
    const task = this.tasks[name]
    if (! task) this.log.fail(`Task "${$t(name)}" does not exist`)

    /* Check for circular dependencies */
    assert(! this._stack.includes(task), `Circular dependency running task "${$t(name)}"`)

    /* Check for cached results */
    const cached = this._cache.get(task)
    if (cached) return cached

    const childRun = new RunImpl(
        task.context.buildDir, // the "buildDir" and "buildFile", used for local resolution (e.g. "./foo.bar") are
        task.context.buildFile, // always the ones associated with the build where the task was defined
        { ...task.context.tasks, ...this.tasks }, // merge the tasks, starting from the ones of the original build
        this._cache, // the cache is a singleton within the whole Run tree, it's passed unchanged
        [ ...this._stack, task ], // the stack gets added the task being run...
        name,
    )

    /* Actually _call_ the `Task` and get a promise for it */
    const promise = runAsync(childRun, name, () => childRun._run(name, task))

    /* Cache the execution promise (never run the smae task twice) */
    this._cache.set(task, promise)
    return promise
  }

  private async _run(name: string, task: Task): Promise<Files | undefined> {
    const now = Date.now()
    this.log.notice(`Starting task ${$t(name)}...`)

    const thisBuild: ThisBuild<any> = {}

    for (const name in this.tasks) {
      thisBuild[name] = ((): PipeImpl<Files | undefined> => {
        return new PipeImpl(this.call(name), this)
      }) as ((() => Promise<undefined>) |(() => Pipe & Promise<Files>))
    }

    try {
      const result = await task.call(thisBuild, this)
      this.log.notice(`Task ${$t(name)} completed in %d ms`, Date.now() - now)
      return result
    } catch (error) {
      const reason = error === buildFailed ? [] : [ error ]
      this.log.fail(`Task ${$t(name)} failed in %d ms`, Date.now() - now, ...reason)
    }
  }

  resolve(...paths: string[]): AbsolutePath {
    const path = join(...paths)
    if (! path) return this.buildDir

    if (path.startsWith('@')) {
      const relative = path.substring(1)
      assert(! isAbsolutePath(relative), `Path component of "${path}" is absolute`)
      return resolveAbsolutePath(getCurrentWorkingDirectory(), relative)
    }

    if (isAbsolutePath(path)) return path

    return resolveAbsolutePath(this.buildDir, path)
  }

  files(...paths: string[]): FilesBuilder {
    return Files.builder(this.resolve(...paths))
  }

  find(glob: string, ...args: ParseOptions<FindOptions>): Pipe & Promise<Files> {
    const { params, options: { directory, ...options } } = parseOptions(args, {})

    const promise = Promise.resolve().then(async () => {
      const builder = this.files(directory || '.')
      for await (const file of walk(builder.directory, [ glob, ...params ], options)) {
        builder.add(file)
      }
      return builder.build()
    })

    return this.pipe(promise)
  }

  pipe(files: Files | Promise<Files>): Pipe & Promise<Files> {
    return new PipeImpl(files, this)
  }
}

/** Create a new {@link Run} associated with the given {@link BuildContext}. */
export function initRun(context: BuildContext, taskName?: string): Run {
  return new RunImpl(
      context.buildDir,
      context.buildFile,
      context.tasks,
      new Map<Task, Promise<Files | undefined>>(),
      [],
      taskName,
  )
}
