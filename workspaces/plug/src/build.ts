import { BuildFailure, assert } from './asserts'
import { runAsync } from './async'
import { $grn, $gry, $ms, $p, $plur, $t, $ylw, NOTICE, getLogger, log, logOptions } from './logging'
import { Context, ContextPromises, PipeImpl } from './pipe'
import { findCaller } from './utils/caller'
import { getSingleton } from './utils/singleton'

import type { Pipe } from './index'
import type { AbsolutePath } from './paths'
import type {
  Build,
  BuildDef,
  BuildProps,
  BuildTasks,
  Props,
  Result,
  State,
  Task,
  TaskCall,
  TaskDef,
  Tasks,
  ThisBuild,
} from './types'

/* ========================================================================== *
 * INTERNAL UTILITIES                                                         *
 * ========================================================================== */

/**
 * Symbol indicating that an object is a {@link Build}.
 *
 * In a compiled {@link Build} this symbol will be associated with a function
 * taking an array of strings (task names) and record of props to override
 */
const buildMarker = Symbol.for('plugjs:plug:types:Build')

/** Symbol indicating that an object is a {@link TaskCall} */
const taskCallMarker = Symbol.for('plugjs:plug:types:TaskCall')

/** Type guard for {@link TaskCall}s */
function isTaskCall(something: any): something is TaskCall {
  return something[taskCallMarker] === taskCallMarker
}

/** Shallow merge two records */
function merge<A, B>(a: A, b: B): A & B {
  return Object.assign(Object.create(null), a, b)
}

/** Create a {@link State} from its components */
function makeState(state: {
  cache?: Map<Task, Promise<Result>>
  stack?: Task[],
  tasks?: Record<string, Task>
  props?: Record<string, string>
  fails?: Set<Task>
}): State {
  const {
    cache = new Map(),
    fails = new Set(),
    stack = [],
    tasks = {},
    props = {},
  } = state

  return { cache, fails, stack, tasks, props } as State
}

/* ========================================================================== *
 * TASK IMPLEMENTATION                                                        *
 * ========================================================================== */

const lastIdKey = Symbol.for('plugjs:plug:singleton:taskId')
const taskId = getSingleton(lastIdKey, () => ({ id: 0 }))

class TaskImpl<R extends Result> implements Task<R> {
  public readonly before: Task<Result>[] = []
  public readonly after: Task<Result>[] = []
  public readonly id: number = ++ taskId.id

  props: Props<BuildDef>
  tasks: Tasks<BuildDef>

  constructor(
      public readonly name: string,
      public readonly buildFile: AbsolutePath,
      private readonly _def: TaskDef,
      _tasks: Record<string, Task>,
      _props: Record<string, string>,
  ) {
    this.tasks = _tasks as Tasks
    this.props = _props as Props
  }

  async invoke(state: State, taskName: string): Promise<R> {
    assert(! state.stack.includes(this), `Recursion detected calling ${$t(taskName)}`)

    /* Check cache */
    const cached = state.cache.get(this)
    if (cached) return cached as Promise<R>

    /* Create new substate merging sibling tasks/props and adding this to the stack */
    state = makeState({
      props: merge(this.props, state.props),
      tasks: merge(this.tasks, state.tasks),
      stack: [ ...state.stack, this ],
      cache: state.cache,
      fails: state.fails,
    })

    /* Create run context and build */
    const context = new Context(this.buildFile, taskName)

    /* The build (the `this` value calling the definition) is a proxy */
    const build = new Proxy({}, {
      get: (_: any, name: string): void | string | (() => Pipe) => {
        // Tasks first, props might come also from environment
        if (name in state.tasks) {
          return (): Pipe => {
            const promise = (state as any).tasks[name]!.invoke(state, name)
            return new PipeImpl(context, promise)
          }
        } else if (name in state.props) {
          return (state as any).props[name]
        }
      },
    })

    /* Run all tasks hooked _before_ this one */
    for (const before of this.before) await before.invoke(state, before.name)

    /* Some logging */
    context.log.info('Running...')
    const now = Date.now()

    /* Run asynchronously in an asynchronous context */
    const promise = runAsync(context, async () => {
      return await this._def.call(build) || undefined
    }).then(async (result) => {
      const level = taskName.startsWith('_') ? 'info' : 'notice'
      context.log[level](`Success ${$ms(Date.now() - now)}`)
      return result
    }).catch((error) => {
      state.fails.add(this)
      context.log.error(`Failure ${$ms(Date.now() - now)}`, error)
      throw BuildFailure.fail()
    }).finally(async () => {
      await ContextPromises.wait(context)
    }).then(async (result) => {
      for (const after of this.after) await after.invoke(state, after.name)
      return result
    })

    /* Cache the resulting promise and return it */
    state.cache.set(this, promise)
    return promise as Promise<R>
  }
}

/* ========================================================================== *
 * BUILD COMPILER                                                             *
 * ========================================================================== */

/** Compile a {@link BuildDef | build definition} into a {@link Build} */
export function plugjs<
  D extends BuildDef, B extends ThisBuild<D>
>(def: D & ThisType<B>): Build<D> {
  const buildFile = findCaller(plugjs)
  const tasks: Record<string, Task> = {}
  const props: Record<string, string> = {}

  /* Iterate through all definition extracting properties and tasks */
  for (const [ key, val ] of Object.entries(def)) {
    let len = 0
    if (isTaskCall(val)) { // this goes first, tasks calls _are_ functions!
      tasks[key] = val.task
      len = key.length
    } else if (typeof val === 'string') {
      props[key] = val
    } else if (typeof val === 'function') {
      tasks[key] = new TaskImpl(key, buildFile, val, tasks, props)
      len = key.length
    }

    /* Update the logger's own "taskLength" for nice printing */
    if ((logOptions.level >= NOTICE) && (key.startsWith('_'))) continue
    /* coverage ignore if */
    if (len > logOptions.taskLength) logOptions.taskLength = len
  }

  /* A function _starting_ a build */
  const start = async function start<R>(
      callback: (state: State) => Promise<R>,
      overrideProps: Record<string, string | undefined> = {},
  ): Promise<R> {
    /* Let's go down to business */
    const state = makeState({ tasks, props: merge(props, overrideProps) })
    const logger = getLogger()
    logger.notice('Starting...')
    const now = Date.now()

    try {
      const result = await callback(state)
      logger.notice(`Build successful ${$ms(Date.now() - now)}`)
      return result
    } catch (error) {
      if (state.fails.size) {
        logger.error('')
        logger.error($plur(state.fails.size, 'task', 'tasks'), 'failed:')
        state.fails.forEach((task) => logger.error($gry('*'), $t(task.name)))
        logger.error('')
      }
      throw logger.fail(`Build failed ${$ms(Date.now() - now)}`, error)
    }
  }

  /* Create the "invoke" function for this build */
  const invoke = async function invoke(
      taskNames: readonly string[],
      overrideProps: Record<string, string | undefined> = {},
  ): Promise<void> {
    await start(async (state: State): Promise<void> => {
      for (const name of taskNames) {
        const task = tasks[name]
        assert(task, `Task ${$t(name)} not found in build ${$p(buildFile)}`)
        await task.invoke(state, name)
      }
    }, overrideProps)
  }

  /* Convert our Tasks into TaskCalls */
  const callables: Record<string, TaskCall> = {}
  for (const [ name, task ] of Object.entries(tasks)) {
    /** The callable function, using "start" */
    const callable = async (overrideProps?: Record<string, string>): Promise<Result> =>
      start(async (state: State): Promise<Result> =>
        task.invoke(state, name), overrideProps)

    /* Extra properties for our callable: marker, task and name */
    callables[name] = Object.defineProperties(callable, {
      [taskCallMarker]: { value: taskCallMarker },
      'task': { value: task },
      'name': { value: name },
    }) as TaskCall
  }

  /* Create and return our build */
  const compiled = merge(props, callables)
  Object.defineProperty(compiled, buildMarker, { value: invoke })
  return compiled as Build<D>
}

/** @deprecated Please use the new {@link plugjs} export */
export const build: typeof plugjs = function<
  D extends BuildDef, B extends ThisBuild<D>
>(def: D & ThisType<B>): Build<D> {
  log.warn(`Use of deprecated ${$ylw('build')} entry point, please use ${$grn('plugjs')}`)
  return plugjs(def)
}

/** Check if the specified build is actually a {@link Build} */
export function isBuild(build: any): build is Build<Record<string, any>> {
  return build && typeof build[buildMarker] === 'function'
}

/** Invoke a number of tasks in a {@link Build} */
export function invokeTasks<B extends Build>(
    build: B,
    tasks: readonly BuildTasks<B>[],
    props?: BuildProps<B>,
): Promise<void> {
  if (isBuild(build)) {
    return (build as any)[buildMarker](tasks, props)
  } else {
    throw new TypeError('Invalid build instance')
  }
}

/* ========================================================================== *
 * HOOKS                                                                      *
 * ========================================================================== */

/** Make sure that the specified hooks run _before_ the given tasks */
export function hookBefore<B extends Build, T extends keyof B>(
    build: B,
    taskName: string & T & BuildTasks<B>,
    hooks: readonly (string & Exclude<BuildTasks<B>, T>)[],
): void {
  const taskCall = build[taskName]
  assert(isTaskCall(taskCall), `Task "${$t(taskName)}" not found in build`)

  for (const hook of hooks) {
    const beforeHook = build[hook] as any
    assert(isTaskCall(beforeHook), `Task "${$t(hook)}" to hook before "${$t(taskName)}" not found in build`)
    if (taskCall.task.before.includes(beforeHook.task)) continue
    taskCall.task.before.push(beforeHook.task)
  }
}

/** Make sure that the specified hooks run _after_ the given tasks */
export function hookAfter<B extends Build, T extends keyof B>(
    build: B,
    taskName: string & T & BuildTasks<B>,
    hooks: readonly (string & Exclude<BuildTasks<B>, T>)[],
): void {
  const taskCall = build[taskName]
  assert(isTaskCall(taskCall), `Task "${$t(taskName)}" not found in build`)

  for (const hook of hooks) {
    const afterHook = build[hook] as any
    assert(isTaskCall(afterHook), `Task "${$t(hook)}" to hook after "${$t(taskName)}" not found in build`)
    if (taskCall.task.after.includes(afterHook.task)) continue
    taskCall.task.after.push(afterHook.task)
  }
}
