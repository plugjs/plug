import type {
  Build,
  BuildDef,
  Props,
  Result,
  State,
  Task,
  TaskDef,
  Tasks,
  ThisBuild,
} from './types'

import { assert, fail, failure, isBuildFailure } from './assert'
import { runAsync } from './async'
import { Files } from './files'
import { $ms, $t, getLogger, logOptions } from './log'
import { AbsolutePath } from './paths'
import { Context, Pipe, Plug, PlugFunction } from './pipe'
import { findCaller } from './utils/caller'
import { parseOptions } from './utils/options'

/* ========================================================================== *
 * PIPE                                                                       *
 * ========================================================================== */

class PipeImpl extends Pipe implements Pipe, Promise<Result> {
  readonly [Symbol.toStringTag] = 'PipeImpl'

  constructor(
      private readonly _promise: Promise<Result>,
      private readonly _promises: Set<Promise<Result>>,
      private readonly _context: Context,
  ) {
    super()
    _promises.add(_promise)
  }

  /* ------------------------------------------------------------------------ *
   * Promise<Files | undefined> implementation                                *
   * ------------------------------------------------------------------------ */

  then<R1 = Result, R2 = never>(
      onfulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null | undefined,
      onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null | undefined,
  ): Promise<R1 | R2> {
    return this._promise.then(onfulfilled, onrejected)
  }

  catch<R = never>(
      onrejected?: ((reason: any) => R | PromiseLike<R>) | null | undefined,
  ): Promise<Result | R> {
    return this._promise.catch(onrejected)
  }

  finally(onfinally?: (() => void) | null | undefined): Promise<Result> {
    return this._promise.finally(onfinally)
  }

  /* ------------------------------------------------------------------------ *
   * Pipe implementation                                                      *
   * ------------------------------------------------------------------------ */

  plug(plug: Plug<Files>): Pipe
  plug(plug: PlugFunction<Files>): Pipe
  plug(plug: Plug<void | undefined>): Promise<undefined>
  plug(plug: PlugFunction<void | undefined>): Promise<undefined>
  plug(arg: Plug<Result | void> | PlugFunction<Result | void>): Pipe | Promise<undefined> {
    const plug = typeof arg === 'function' ? { pipe: arg } : arg

    const promise = this._promise.then(async (files) => {
      assert(files, 'Unable to extend Pipe')
      const result = await plug.pipe(files, this._context)
      assert(result, 'Plug did not return a Files instance')
      return result
    })

    return new PipeImpl(promise, this._promises, this._context)
  }

  async run(): Promise<Files> {
    return this._promise.then((whaps) => {
      assert(whaps, 'Unable to run Pipe')
      return whaps
    })
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

  call(state: State, taskName: string): Promise<Result> {
    assert(! state.stack.includes(this), `Recursion detected calling ${$t(taskName)}`)

    /* Check cache */
    const cached = state.cache.get(this)
    if (cached) return cached

    /* Create new substate merging sibling tasks/props and adding this to the stack */
    const props: Record<string, string> = Object.assign({}, this.props, state.props)
    const tasks: Record<string, Task> = Object.assign({}, this.tasks, state.tasks)
    const stack = [ ...state.stack, this ]
    const cache = state.cache

    /* Create run context and build */
    const promises = new Set<Promise<Result>>()
    const context = new Context(this.buildFile, taskName)

    const build = new Proxy({}, {
      get(_: any, name: string): void | string | (() => Pipe & Promise<Result>) {
        // Tasks first, props might come also from environment
        if (name in tasks) {
          return (): Pipe & Promise<Result> => {
            const state = { stack, cache, tasks, props }
            const promise = tasks[name].call(state, name)
            return new PipeImpl(promise, promises, context)
          }
        } else if (name in props) {
          return props[name]
        }
      },
    })

    /* Some logging */
    context.log.info('Running...')
    const now = Date.now()

    /* Run asynchronously in an asynchronous context */
    const promise = runAsync(context, taskName, async () => {
      try {
        /* Call the task definition and run the eventually returned pipe */
        let result = await this._def.call(build)
        if (result && 'run' in result) result = await result.run()
        return result || undefined
      } finally {
        /* Make sure we _await_ all promises (PipeImpl) created by the task */
        const settlements = await Promise.allSettled([ ...promises ])

        /* Get any error */
        const errors = new Set<any>()
        for (const settlement of settlements) {
          if (settlement.status === 'fulfilled') continue
          if (! isBuildFailure(settlement.reason)) {
            errors.add(settlement.reason)
          }
        }

        /* Log any error detected, but don't file (think try/catch) */
        for (const error of errors) context.log.error(error)
      }
    }).then((result) => {
      context.log.notice(`Success ${$ms(Date.now() - now)}`)
      return result
    }).catch((error) => {
      context.log.error(`Failure ${$ms(Date.now() - now)}`, error)
      throw failure()
    })

    /* Cache the resulting promise and return it */
    cache.set(this, promise)
    return promise
  }
}

/* ========================================================================== *
 * BUILD COMPILER                                                             *
 * ========================================================================== */

/** Symbol indicating that an object is a Build */
const buildMarker = Symbol.for('plugjs:isBuild')

/** Compile a {@link BuildDef | build definition} into a {@link Build} */
export function build<
  D extends BuildDef, B extends ThisBuild<D>
>(def: D & ThisType<B>): Build<D> {
  const buildFile = findCaller(build)
  const tasks: Record<string, Task> = {}
  const props: Record<string, string> = {}

  /* Iterate through all definition extracting properties and tasks */
  for (const [ key, val ] of Object.entries(def)) {
    let len = 0
    if (typeof val === 'string') {
      props[key] = val
    } else if (typeof val === 'function') {
      tasks[key] = new TaskImpl(buildFile, tasks, props, val)
      len = key.length
    } else if (val instanceof TaskImpl) {
      tasks[key] = val
      len = key.length
    }

    /* Update the logger's own "taskLength" for nice printing */
    if (len > logOptions.taskLength) logOptions.taskLength = len
  }

  /* Create the "call" function for this build */
  const call: BuildCall = async function call(
      taskNames: string[],
      overrideProps: Record<string, string | undefined> = {},
  ): Promise<void> {
    /* Our "root" logger and initial (empty) state */
    const logger = getLogger('')
    const state = {
      cache: new Map<Task, Promise<Result>>(),
      stack: [] as Task[],
      props: Object.assign({}, props, overrideProps),
      tasks: tasks,
    }

    /* Let's go down to business */
    logger.notice('Starting...')
    const now = Date.now()

    try {
      /* Run tasks _serially_ */
      for (const taskName of taskNames) {
        if (taskName in tasks) {
          await tasks[taskName].call(state, taskName)
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

  /* Create our build, the collection of all props and tasks */
  const compiled = Object.assign({}, props, tasks) as Build<D>

  /* Sneak our "call" function in the build, for the CLI and "call" below */
  Object.defineProperty(compiled, buildMarker, { value: call })

  /* All done! */
  return compiled
}

/** Internal type identifying all _task names_ in a {@link Build} */
type TaskNames<B extends Build> = string & keyof B &
(B extends Build<BuildDef, infer Tasks, Props> ? keyof Tasks : never)

/** Internal type identifying all _property names_ in a {@link Build} */
type OverrideProps<B extends Build> = {
  [ k in keyof B as B[k] extends string ? k : never ]?: string
}

/** Internal type describing the build call function */
type BuildCall = (tasks: string[], props?: Record<string, string | undefined>) => Promise<void>

/** Serially invoke tasks in a {@link Build} optionally overriding properties */
export function call<B extends Build>(
    build: B,
    ...args:
    | [ ...taskNames: [ TaskNames<B>, ...TaskNames<B>[] ] ]
    | [ ...taskNames: [ TaskNames<B>, ...TaskNames<B>[] ], options: OverrideProps<B> ]
): Promise<void> {
  const { params: tasks, options: props } = parseOptions(args, {})

  /* Get the calling function from the sneaked-in property in build */
  const call: BuildCall = (build as any)[buildMarker]

  /* Triple check that we actually _have_ a function */
  if (typeof call !== 'function') fail('Unknown build type')

  /* Call everyhin that needs to be called */
  return call(tasks, props)
}
