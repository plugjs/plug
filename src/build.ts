import type {
  Build,
  BuildDef,
  CompiledBuild,
  FindOptions,
  PipeName,
  Plug,
  PlugFunction,
  PropName,
  Props,
  Result,
  RunContext,
  Runnable,
  State,
  Task,
  TaskContext,
  TaskDef,
  TaskName,
  Tasks,
  TasksResult,
  TasksResults,
} from './types'

import { assert, fail, failure } from './assert'
import { runAsync } from './async'
import { Files } from './files'
import { $ms, $t, getLogger, logOptions } from './log'
import { AbsolutePath, commonPath, getCurrentWorkingDirectory } from './paths'
import { Pipe } from './pipe'
import { RunImpl } from './run'
import { findCaller } from './utils/caller'
import { ParseOptions, parseOptions } from './utils/options'
import { walk } from './utils/walk'

/* ========================================================================== *
 * PIPE                                                                       *
 * ========================================================================== */

class PipeImpl extends Pipe implements Pipe {
  constructor(
      private readonly _build: { pipes: Set<Pipe>, context: RunContext },
      private readonly _start: () => Promise<Files>,
  ) {
    super()
    _build.pipes.add(this)
  }

  plug(plug: Plug<Files> | PlugFunction<Files>): Pipe
  plug(plug: Plug<undefined> | PlugFunction<undefined>): Runnable<undefined>
  plug(arg: Plug<Result> | PlugFunction<Result>): Pipe | Runnable<undefined> {
    const plug = typeof arg === 'function' ? { pipe: arg } : arg

    const parent = this
    return new PipeImpl(this._build, async (): Promise<any> => {
      const files = await parent.run() // always call run, it clears pipes!
      assert(files, 'Unable to extend pipe')
      return await plug.pipe(files, this._build.context)
    })
  }

  async run(): Promise<Files> {
    return this._start().finally(() => this._build.pipes.delete(this))
  }
}

/* ========================================================================== *
 * TASK                                                                       *
 * ========================================================================== */

class TaskImpl implements Task {
  constructor(
      public readonly buildFile: AbsolutePath,
      public readonly tasks: Tasks,
      public readonly props: Props,
      private readonly _def: TaskDef,
  ) {}

  call(state: State, context: TaskContext, taskName: string): Promise<Result> {
    assert(! state.stack.includes(this), `Recursion detected calling ${$t(taskName)}`)

    /* Check cache */
    const cached = state.cache.get(this)
    if (cached) return cached

    /* Create new substate, adding this task */
    const stack = [ ...state.stack, this ]
    const cache = state.cache

    /* Create run context and build */
    const run = new RunImpl(this.buildFile, taskName)
    const build = new BuildImpl(
        Object.assign({}, this.tasks, context.tasks),
        Object.assign({}, this.props, context.props),
        run, { cache, stack },
    )

    /* Some logging */
    run.log.info('Running...')
    const now = Date.now()

    /* Run asynchronously in an asynchronous context */
    const promise = runAsync(run, taskName, async () => {
      /* Call the task definition and run the eventually returned pipe */
      let result = await this._def.call(build)
      if (result && 'run' in result) {
        result = await result.run()
      }

      /* Any pipe not run yet gets run (serially) */
      for (const pipe of build.pipes) await pipe.run()

      /* All done! */
      return result || undefined
    }).then((result) => {
      run.log.notice(`Success ${$ms(Date.now() - now)}`)
      return result
    }).catch((error) => {
      run.log.error(`Failure ${$ms(Date.now() - now)}`, error)
      throw failure()
    })

    /* Cache the resulting promise and return it */
    cache.set(this, promise)
    return promise
  }
}

/* ========================================================================== *
 * BUILD                                                                      *
 * ========================================================================== */

class BuildImpl<
  D extends BuildDef,
  T extends Tasks<D> = Tasks<D>,
  P extends Props<D> = Props<D>,
> implements Build<D, T, P> {
  readonly pipes = new Set<Pipe>()

  constructor(
      public readonly tasks: T,
      public readonly props: P,
      public readonly context: RunContext,
      private readonly _state: State,
  ) {}

  get<K extends PropName<P>>(prop: K): string {
    assert(prop in this.props, `Property ${$t(prop)} unknown`)
    return this.props[prop]
  }

  getNumber<K extends PropName<P>>(prop: K): number {
    const value = Number(this.get(prop))
    assert(! isNaN(value), `Property ${$t(prop)} is not a number`)
    return value
  }
  getInteger<K extends PropName<P>>(prop: K): number {
    const value = this.getNumber(prop)
    assert(value === Math.floor(value), `Property ${$t(prop)} is not an integer`)
    return value
  }

  getBigInt<K extends PropName<P>>(prop: K): bigint {
    try {
      return BigInt(this.get(prop))
    } catch (error) {
      fail(`Property ${$t(prop)} is not a big integer`)
    }
  }

  getBoolean<K extends PropName<P>>(prop: K): boolean {
    const value = this.get(prop).toLowerCase()
    switch (value) {
      case 'true': return true
      case 'false': return false
      default: fail(`Property ${$t(prop)} is not "true" or "false"`)
    }
  }

  getPath<K extends PropName<P>>(prop: K): AbsolutePath {
    return this.context.resolve(this.get(prop))
  }

  async run<K extends TaskName<T>>(task: K): Promise<TasksResult<D, T>[K]> {
    const result = await this.tasks[task].call(this._state, this, task)
    return result as TasksResult<D, T>[K]
  }

  async parallel<A extends readonly TaskName<T>[]>(...tasks: A): Promise<TasksResults<D, T, A>> {
    const promises = tasks.map((task) => this.run(task))

    let errors = 0
    const results: Result[] = []
    const settlements = await Promise.allSettled(promises)
    for (const settlement of settlements) {
      if (settlement.status === 'fulfilled') {
        results.push(settlement.value)
      } else {
        this.context.log.error(settlement.reason)
        errors ++
      }
    }

    if (errors) throw failure()
    return results as TasksResults<D, T, A>
  }

  async series<A extends readonly TaskName<T>[]>(...tasks: A): Promise<TasksResults<D, T, A>> {
    const results: Result[] = []
    for (const task of tasks) results.push(await this.run(task))
    return results as TasksResults<D, T, A>
  }

  pipe<K extends PipeName<T>>(task: K): Pipe {
    return new PipeImpl(this, async () => {
      const files = await this.run(task)
      assert(files, 'Unable to pipe with undefined results')
      return files
    })
  }

  merge<K extends PipeName<T>>(...tasks: (K | Pipe)[]): Pipe {
    return new PipeImpl(this, async () => {
      if (tasks.length === 0) return Files.builder(getCurrentWorkingDirectory()).build()

      const results: Files[] = []

      for (const task of tasks) {
        if (typeof task === 'string') {
          const result = await this.run(task)
          assert(result, `Task ${$t(task)} did not return a Files instance`)
          results.push(result)
        } else {
          const result = await task.run()
          assert(result, 'Pipe did not return a Files result')
          results.push(result)
        }
      }

      const [ first, ...others ] = results

      const firstDir = first.directory
      const otherDirs = others.map((f) => f.directory)

      const directory = commonPath(firstDir, ...otherDirs)

      return Files.builder(directory).merge(first, ...others).build()
    })
  }

  find(glob: string): Pipe
  find(glob: string, ...globs: string[]): Pipe
  find(glob: string, options: FindOptions): Pipe
  find(glob: string, ...extra: [...globs: string[], options: FindOptions]): Pipe
  find(glob: string, ...args: ParseOptions<FindOptions>): Pipe {
    const { params, options: { directory, ...options } } = parseOptions(args, {})

    return new PipeImpl(this, async () => {
      const dir = directory ? this.context.resolve(directory) : getCurrentWorkingDirectory()

      const builder = Files.builder(dir)
      for await (const file of walk(dir, [ glob, ...params ], options)) {
        builder.add(file)
      }

      return builder.build()
    })
  }
}

/* ========================================================================== *
 * BUILD COMPILER                                                             *
 * ========================================================================== */

/** Symbol indicating that an object is a Build */
const buildMarker = Symbol.for('plugjs:isBuild')

export function build<D extends BuildDef, B extends Build<D>>(def: D & ThisType<B>): CompiledBuild<D> {
  const buildFile = findCaller(build)
  const tasks: Record<string, Task> = {}
  const props: Record<string, string> = {}

  for (const [ key, val ] of Object.entries(def)) {
    let len = 0
    if (typeof val === 'string') {
      props[key] = val
    } else if (typeof val === 'function') {
      tasks[key] = new TaskImpl(buildFile, tasks, props, val)
      len = key.length
    } else {
      tasks[key] = val
      len = key.length
    }

    if (len > logOptions.taskLength) logOptions.taskLength = len
  }

  const compiled = async function build(
      ...args: ParseOptions<Partial<Props<D>>>
  ): Promise<void> {
    const { params: taskNames, options } = parseOptions(args, {})

    const logger = getLogger('')

    const state = {
      cache: new Map<Task, Promise<Result>>(),
      stack: [] as Task[],
    }

    const context = {
      props: Object.assign({}, props, options),
      tasks: tasks,
    }

    logger.notice('Starting...')
    const now = Date.now()

    try {
      for (const taskName of taskNames) {
        if (taskName in tasks) {
          await tasks[taskName].call(state, context, taskName)
        } else {
          fail(`Task ${$t(taskName)} not found in build`)
        }
      }
      logger.notice(`Build successful ${$ms(Date.now() - now)}`)
    } catch (error) {
      logger.error(`Build failed ${$ms(Date.now() - now)}`, error)
      throw failure()
    }
  }

  Object.assign(compiled, props, tasks)
  Object.defineProperty(compiled, buildMarker, { value: buildMarker })
  return compiled as CompiledBuild<D>
}
