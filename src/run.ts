import assert from 'assert'
import type { Task } from './task'
import { AbsolutePath, isAbsolutePath, resolveAbsolutePath } from './paths'
import { BuildContext } from './build'
import { Files, FilesBuilder } from './files'
import { ParseOptions, parseOptions } from './utils/options'
import { Pipe } from './pipe'
import { fail, log } from './log'
import { runAsync } from './async'
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

  call(name: string): Promise<Files>
  resolve(path?: string): AbsolutePath
  files(path: string): FilesBuilder
  find(glob: string, ...args: ParseOptions<FindOptions>): Promise<Files>
  pipe(start: (run: Run) => Pipe | Files | Promise<Files>): Pipe
}


/** A {@link Run} represents the context used when invoking a {@link Task}. */
export class RunImpl implements Run {
  private constructor(
    readonly baseDir: AbsolutePath,
    readonly buildDir: AbsolutePath,
    readonly buildFile: AbsolutePath,
    readonly tasks: Readonly<Record<string, Task>>,
    private readonly _cache: Map<Task, Promise<Files>>,
    private readonly _stack: readonly Task[],
  ) {}

  /** Run the specified {@link Task} in the context of this {@link Run} */
  call(name: string): Promise<Files> {
    const task = this.tasks[name]
    if (! task) fail(`Task "${name}" does not exist`) // TODO: colors

    /* Check for circular dependencies */
    if (this._stack.includes(task)) {
      fail(`Circular dependency running task "${name}"`) // TODO: colors & stack
    }

    /* Check for cached results */
    const cached = this._cache.get(task)
    if (cached) return cached

    /* Actually _call_ the `Task` and get a promise for it */
    const promise = runAsync(task, async () => {
      const now = Date.now()
      log.sep().info('Starting task').sep()

      try {
        const result = await task.call(new RunImpl(
          this.baseDir, // the "baseDir" for "@" resolutuion is always unchanged, from the original build file or arg
          task.context.buildDir, // the "buildDir" and "buildFile", used for local resolution (e.g. "./foo.bar") are
          task.context.buildFile, // always the ones associated with the build where the task was defined
          { ...task.context.tasks, ...this.tasks }, // merge the tasks, starting from the ones of the original build
          this._cache, // the cache is a singleton within the whole Run tree, it's passed unchanged
          [ ...this._stack, task ], // the stack gets added the task being run...
        ))

        log.sep().info('Task completed in', Date.now() - now, 'ms').sep()
        return result
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

  files(path: string): FilesBuilder {
    return Files.builder(this.resolve(path))
  }

  async find(glob: string, ...args: ParseOptions<FindOptions>): Promise<Files> {
    const { params, options: { directory, ...options} } = parseOptions(args, {})
    const dir = this.resolve(directory)

    const builder = Files.builder(dir)
    for await (const file of walk(dir, [ glob, ...params ], options)) {
      builder.add(file)
    }

    return builder.build()
  }

  pipe(start: (run: Run) => Files | Promise<Files>): Pipe {
    return new Pipe(start) // TODO: remember this pipe!
  }

  private static _init(context: BuildContext, baseDir?: AbsolutePath): Run {
    return new RunImpl(
      baseDir || context.buildDir,
      context.buildDir,
      context.buildFile,
      context.tasks,
      new Map<Task, Promise<Files>>(),
      [],
    )
  }
}

export function initRun(context: BuildContext, baseDir?: AbsolutePath): Run {
  return (<any> RunImpl)._init(context, baseDir)
}

export function find(glob: string, ...args: ParseOptions<FindOptions>): Pipe {
  // TODO: this pipe needs to end up in the "task"
  return new Pipe((run) => run.pipe((run) => run.find(glob, ...args)))
}
