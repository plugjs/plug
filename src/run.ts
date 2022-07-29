import assert from 'assert'
import type { Task } from './task'
import { AbsolutePath, isAbsolutePath, resolveAbsolutePath } from './paths'
import { BuildContext, ThisBuild } from './build'
import { Files, FilesBuilder } from './files'
import { ParseOptions, parseOptions } from './utils/options'
import { Pipe } from './pipe'
import { fail, log } from './log'
import { currentRun, runAsync } from './async'
import { walk, WalkOptions } from './utils/walk'

/**
 * The {@link FindOptions} interface defines the options available to
 * {@link TaskContext.find}.
 */
export interface FindOptions extends WalkOptions {
  /**
   * The directory where to start looking for files.
   *
   * @defaultValue The current {@link Run.directory}
   */
   directory?: string
}

export interface Run extends BuildContext {
  readonly baseDir: AbsolutePath,
  readonly taskName?: string

  call(name: string): Promise<Files | void>
  resolve(path?: string): AbsolutePath
  files(path?: string): FilesBuilder
  find(glob: string, ...args: ParseOptions<FindOptions>): Pipe
}


/** A {@link Run} represents the context used when invoking a {@link Task}. */
export class RunImpl implements Run {
  private readonly _pipes: Pipe[] = []

  constructor(
    readonly baseDir: AbsolutePath,
    readonly buildDir: AbsolutePath,
    readonly buildFile: AbsolutePath,
    readonly tasks: Readonly<Record<string, Task>>,
    private readonly _cache: Map<Task, Promise<Files | void>>,
    private readonly _stack: readonly Task[],
    readonly taskName?: string,
  ) {}

  /** Run the specified {@link Task} in the context of this {@link Run} */
  call(name: string): Promise<Files | void> {
    const task = this.tasks[name]
    if (! task) fail(`Task "${name}" does not exist`) // TODO: colors

    /* Check for circular dependencies */
    if (this._stack.includes(task)) {
      fail(`Circular dependency running task "${name}"`) // TODO: colors & stack
    }

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
    const promise = runAsync(childRun, name, async () => {
      const now = Date.now()
      log.sep().info('Starting task').sep()

      const thisBuild: ThisBuild<any> = {}
      for (const [ name, task ] of Object.entries(childRun.tasks)) {
        thisBuild[name] = () => {
          const promise = childRun.call(name)
          const pipe = new Pipe(promise, childRun)
          childRun._pipes.push(pipe)
          return pipe
        }
      }

      try {
        const result = await task.call(thisBuild, childRun)

        /* Any pipe created by calling this.xxx(...) gets awaited */
        const results = await Promise.all(childRun._pipes)

        log.sep().info('Task completed in', Date.now() - now, 'ms').sep()

        /* Return the result or an empty `Files` */
        return result || results.pop()
      } catch (error) {
        fail(error, 'Task failed in', Date.now() - now, 'ms')
      }
    })

    /* Cache the execution promise (never run the smae task twice) */
    this._cache.set(task, promise)
    return promise
  }

  resolve(path?: string): AbsolutePath {
    if (! path) return this.buildDir

    if (path.startsWith('@')) {
      const relative = path.substring(1)
      assert(! isAbsolutePath(relative), `Path component of "${path}" is absolute`)
      return resolveAbsolutePath(this.baseDir, relative)
    }

    if (isAbsolutePath(path)) return path

    return resolveAbsolutePath(this.buildDir, path)
  }

  files(path?: string): FilesBuilder {
    return Files.builder(this.resolve(path))
  }

  find(glob: string, ...args: ParseOptions<FindOptions>): Pipe {
    const promise = Promise.resolve().then(async () => {
      const { params, options: { directory, ...options} } = parseOptions(args, {})
      const dir = this.resolve(directory)

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

export function find(glob: string, ...args: ParseOptions<FindOptions>): Pipe {
  const run = currentRun()
  assert(run, 'Unable to find files outside a running task')
  return run.find(glob, ...args)
}
