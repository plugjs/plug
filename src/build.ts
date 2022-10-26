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

import { assert } from './assert'
import { runAsync } from './async'
import { $ms, $t, getLogger, log, logOptions } from './log'
import { AbsolutePath } from './paths'
import { Context, ContextPromises, Pipe } from './pipe'
import { findCaller } from './utils/caller'
import { parseOptions } from './utils/options'

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

  invoke(state: State, taskName: string): Promise<Result> {
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
    const context = new Context(this.buildFile, taskName)

    const build = new Proxy({}, {
      get(_: any, name: string): void | string | (() => Pipe) {
        // Tasks first, props might come also from environment
        if (name in tasks) {
          return (): Pipe => {
            const state = { stack, cache, tasks, props }
            const promise = tasks[name].invoke(state, name)
            return new Pipe(context, promise)
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
      return await this._def.call(build) || undefined
    }).then((result) => {
      context.log.notice(`Success ${$ms(Date.now() - now)}`)
      return result
    }).catch((error) => {
      throw context.log.fail(`Failure ${$ms(Date.now() - now)}`, error)
    }).finally(() => ContextPromises.wait(context, 'Error awaiting task pipes'))

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
  const invoke: InvokeBuild = async function invoke(
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
          await tasks[taskName].invoke(state, taskName)
        } else {
          throw logger.fail(`Task ${$t(taskName)} not found in build`)
        }
      }
      logger.notice(`Build successful ${$ms(Date.now() - now)}`)
    } catch (error) {
      throw logger.fail(`Build failed ${$ms(Date.now() - now)}`, error)
    }
  }

  /* Create our build, the collection of all props and tasks */
  const compiled = Object.assign({}, props, tasks) as Build<D>

  /* Sneak our "call" function in the build, for the CLI and "call" below */
  Object.defineProperty(compiled, buildMarker, { value: invoke })

  /* All done! */
  return compiled
}

/** Internal type identifying all _task names_ in a {@link Build} */
type TaskNames<B extends Build> = string & keyof {
  [ k in keyof B as B[k] extends Task ? k : never ]?: B[k]
}

/** Internal type identifying all _property names_ in a {@link Build} */
type OverrideProps<B extends Build> = {
  [ k in keyof B as B[k] extends string ? k : never ]?: string
}

/** Internal type describing the build invocation function */
type InvokeBuild = (tasks: string[], props?: Record<string, string | undefined>) => Promise<void>

/** Serially invoke tasks in a {@link Build} optionally overriding properties */
export function invoke<B extends Build>(
    build: B,
    ...args:
    | [ ...taskNames: [ TaskNames<B>, ...TaskNames<B>[] ] ]
    | [ ...taskNames: [ TaskNames<B>, ...TaskNames<B>[] ], options: OverrideProps<B> ]
): Promise<void> {
  const { params: tasks, options: props } = parseOptions(args, {})

  /* Get the calling function from the sneaked-in property in build */
  const invoke: InvokeBuild = (build as any)[buildMarker]

  /* Triple check that we actually _have_ a function */
  if (typeof invoke !== 'function') log.fail('Unknown build type')

  /* Call everyhin that needs to be called */
  return invoke(tasks, props)
}
