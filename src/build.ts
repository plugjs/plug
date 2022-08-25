import { assert, fail, failure } from './assert.js'
import { runAsync } from './async.js'
import { Files } from './files.js'
import { $gry, $ms, $t, logOptions, getLogger } from './log.js'
import { AbsolutePath, getAbsoluteParent } from './paths.js'
import { Pipe, PipeImpl } from './pipe.js'
import { Run, RunImpl } from './run.js'
import { Task, TaskImpl } from './task.js'
import { findCaller } from './utils/caller.js'

/* ========================================================================== *
 * TYPES                                                                      *
 * ========================================================================== */

/**
 * The {@link BuildContext} interface exposes the _internal_ representation of
 * a build file, including all {@link Task | Tasks}.
 */
export type BuildContext = {
  /** The absolute file name of the build */
  readonly buildFile: AbsolutePath,
  /** For convenience, the directory of the build file */
  readonly buildDir: AbsolutePath,
  /** A record of all tasks keyed by name */
  readonly tasks: Readonly<Record<string, Task>>
}

/**
 * A {@link TaskDefinition} is a _function_ defining a {@link Task}.
 */
export type TaskDefinition<B> =
  (this: ThisBuild<B>, self: ThisBuild<B>, run: Run) => Files | undefined | void | Promise<Files | undefined | void>

/**
 * A {@link TaskCall} describes a _function_ calling a {@link Task}, and
 * it is exposed to outside users of the {@link Build}.
 */
export type TaskCall<T extends Files | undefined> = ((run?: Run) => Promise<Run>) & {
  readonly task: Task<T>
}

/**
 * A {@link Build} is a collection of {@link TaskCall | TaskCalls}, as produced
 * by the {@link build} function from a {@link BuildDefinition}.
 */
export type Build<B> = {
  [ K in keyof B ]:
    B[K] extends TaskCall<infer T> ? TaskCall<T> :
    B[K] extends () => Files | Promise<Files> ? TaskCall<Files> :
    B[K] extends () => undefined | void | Promise<undefined | void> ? TaskCall<undefined> :
    never
}

/**
 * The type supplied as `this` to a {@link TaskDefinition} when invoking it.
 */
export type ThisBuild<B> = {
  [ K in keyof B ] :
    B[K] extends () => Files | Promise<Files> ?
      () => Pipe & Promise<Files> :
    B[K] extends () => undefined | void | Promise<undefined | void> ?
      () => Promise<undefined> :
    B[K] extends TaskCall<infer T> ?
      T extends Files ? () => T & Pipe : () => T :
    never
}

/**
 * A {@link BuildDefinition} is a collection of
 * {@link TaskDefinition | TaskDefinitions} that the {@link build} function will
 * use to create a {@link Build}.
 *
 * A {@link BuildDefinition} can also include other {@link TaskCall | TaskCalls},
 * thus giving the ability to extend other {@link Build | Builds}.
 */
export type BuildDefinition<B> = {
  [ K in keyof B ] : TaskDefinition<B> | TaskCall<Files | undefined>
}

/* ========================================================================== *
 * BUILD                                                                      *
 * ========================================================================== */

/** Symbol indicating that an object is a Build */
const buildMarker = Symbol.for('plugjs:isBuild')

/** Check if the specified build is actually a {@link Build} */
export function isBuild(build: any): build is Build<any> {
  return build && build[buildMarker] === buildMarker
}

/** Create a new {@link Build} from its {@link BuildDefinition}. */
export function build<D extends BuildDefinition<D>>(
    definition: D & ThisType<ThisBuild<D>>,
): Build<D> {
  /* Basic setup */
  const buildFile = findCaller(build).file
  const buildDir = getAbsoluteParent(buildFile)
  const tasks: Record<string, Task> = {}

  const context: BuildContext = { buildFile, buildDir, tasks }
  const result: Build<any> = {}

  /* Loop through all the definitions */
  for (const name in definition) {
    /* Each  entry in our definition is a `TaskDefinition` or `TaskCall` */
    const def = definition[name]
    const task: Task = 'task' in def ? def.task : new TaskImpl(context, def)

    /* Prepare the _new_ `TaskCall` that will wrap our `Task` */
    const call = (async (run?: Run): Promise<Run> => {
      /* Create a new run, or reuse the one given to us */
      if (! run) run = run = new BuildRun(buildDir, buildFile, tasks)
      assert(run instanceof BuildRun, 'Incompatible Run specified')

      /* Start the build, call the task, log errors */
      run.log.notice('Starting build...')
      const now = Date.now()
      let error: any = undefined
      try {
        await run.call(name)
      } catch (err) {
        run.log.error(err)
        error = err
      }

      /* Build is finished, so _await_ all pending tasks and be done! */
      try {
        /* This will await all pending tasks, log, and throw if any failed */
        await run.finish()

        /* We should never get here, but just in case... */
        if (error !== undefined) throw error

        /* All done, we can return the run */
        run.log.notice('Build completed', $ms(Date.now() - now))
        return run
      } catch (error) {
        /* Log our failure and throw in case of errors */
        run.log.error(`Build failed ${$ms(Date.now() - now)}`, error)
        throw failure()
      }
    })

    /* Gite the task call a proper "name" (for nicer stack  traces) */
    Object.defineProperty(call, 'name', { enumerable: true, value: name })

    /* Register task length for nice logs */
    if (name.length > logOptions.taskLength) {
      logOptions.taskLength = name.length
    }

    /* Remember our stuff and onto the next! */
    result[name] = Object.assign(call, { task })
    tasks[name] = task
  }

  /* All done! */
  Object.defineProperty(result, buildMarker, { value: buildMarker })
  return result
}

/* ========================================================================== *
 * RUN IMPLEMENTATION                                                         *
 * ========================================================================== */

/** Implementation of the {@link Run} interface for builds (has tasks!). */
class BuildRun extends RunImpl implements Run {
  constructor(
      buildDir: AbsolutePath,
      buildFile: AbsolutePath,
      private readonly _tasks: Readonly<Record<string, Task>>,
      private readonly _stack: readonly Task[] = [],
      private readonly _cache = new Map<Task, { name: string, promise: Promise<Files | undefined> }>(),
      taskName: string = '',
  ) {
    super({ taskName, buildDir, buildFile })
  }

  async finish(): Promise<void> {
    const names: string[] = []
    const promises: Promise<Files | undefined>[] = []

    for (const { name, promise } of this._cache.values()) {
      names.push(name)
      promises.push(promise)
    }

    const settlements = await Promise.allSettled(promises)

    const failures = settlements.reduce((failures, settlement, i) => {
      if (settlement.status === 'rejected') {
        const name = names[i]
        getLogger(name).error(settlement.reason)
        failures.push(name)
      }
      return failures
    }, [] as string[])

    if (failures.length) {
      const message = `${failures.length === 1 ? 'task has' : 'tasks have'}`
      const names = failures.map((task) => $t(task)).join($gry(', '))
      this.log.error(failures.length, message, 'failed:', names)
      throw failure()
    }
  }

  call(name: string): Promise<Files | undefined> {
    const task = this._tasks[name]
    if (! task) fail(`Task "${$t(name)}" does not exist`)

    /* Check for circular dependencies */
    assert(! this._stack.includes(task), `Circular dependency running task "${$t(name)}"`)

    /* Check for cached results */
    const cached = this._cache.get(task)
    if (cached) return cached.promise

    const childRun = new BuildRun(
        task.context.buildDir, // the "buildDir" and "buildFile", used for local resolution (e.g. "./foo.bar") are
        task.context.buildFile, // always the ones associated with the build where the task was defined
        { ...task.context.tasks, ...this._tasks }, // merge the tasks, starting from the ones of the original build
        [ ...this._stack, task ], // the stack gets added the task being run...
        this._cache, // the cache is a singleton within the whole Run tree, it's passed unchanged
        name,
    )

    /* Actually _call_ the `Task` and get a promise for it */
    const promise = runAsync(childRun, name, () => childRun._run(name, task))

    /* Cache the execution promise (never run the smae task twice) */
    this._cache.set(task, { name, promise })
    return promise
  }

  private async _run(name: string, task: Task): Promise<Files | undefined> {
    const now = Date.now()
    this.log.notice(`Starting task ${$t(name)}...`)

    const thisBuild: ThisBuild<any> = {}

    for (const name in this._tasks) {
      thisBuild[name] = ((): PipeImpl<Files | undefined> => {
        return new PipeImpl(this.call(name), this)
      }) as ((() => Promise<undefined>) |(() => Pipe & Promise<Files>))
    }

    try {
      const result = await task.call(thisBuild, this)
      this.log.notice(`Task ${$t(name)} completed`, $ms(Date.now() - now))
      return result
    } catch (error) {
      this.log.error(`Task ${$t(name)} failed ${$ms(Date.now() - now)}`, error)
      throw failure()
    }
  }
}
