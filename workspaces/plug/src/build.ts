import { assert } from './asserts'
import { runAsync } from './async'
import { $gry, $ms, $p, $t, getLogger, logOptions } from './logging'
import { Context, ContextPromises, PipeImpl } from './pipe'
import { findCaller } from './utils/caller'

import type { Pipe } from './index'
import type { AbsolutePath } from './paths'
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

/* ========================================================================== *
 * TASK                                                                       *
 * ========================================================================== */

/** Symbol indicating that an object is a {@link Task} */
const taskMarker = Symbol.for('plugjs:isTask')

/** Type guard for {@link Tasks} */
function isTask(something: any): something is Task {
  return something[taskMarker] === true
}

/** Create a new {@link Task} instance */
function makeTask(
    buildFile: AbsolutePath,
    tasks: Tasks,
    props: Props,
    _def: TaskDef,
    _name: string,
): Task {
  /* Invoke the task, checking call stack, caches, and merging builds */
  async function invoke(state: State, taskName: string): Promise<Result> {
    assert(! state.stack.includes(task), `Recursion detected calling ${$t(taskName)}`)

    /* Check cache */
    const cached = state.cache.get(task)
    if (cached) return cached

    /* Create new substate merging sibling tasks/props and adding this to the stack */
    const props: Record<string, string> = Object.assign({}, task.props, state.props)
    const tasks: Record<string, Task> = Object.assign({}, task.tasks, state.tasks)
    const stack = [ ...state.stack, task ]
    const cache = state.cache
    const fails = state.fails
    state = { stack, cache, fails, tasks, props }

    /* Create run context and build */
    const context = new Context(task.buildFile, taskName)

    /* The build (the `this` value calling the definition) is a proxy */
    const build = new Proxy({}, {
      get(_: any, name: string): void | string | (() => Pipe) {
        // Tasks first, props might come also from environment
        if (name in tasks) {
          return (): Pipe => {
            const promise = tasks[name]!.invoke(state, name)
            return new PipeImpl(context, promise)
          }
        } else if (name in props) {
          return props[name]
        }
      },
    })

    /* Run all tasks hooked _before_ this one */
    for (const before of task.before) await before.invoke(state, before.name)

    /* Some logging */
    context.log.info('Running...')
    const now = Date.now()

    /* Run asynchronously in an asynchronous context */
    const promise = runAsync(context, taskName, async () => {
      return await _def.call(build) || undefined
    }).then(async (result) => {
      const level = taskName.startsWith('_') ? 'info' : 'notice'
      context.log[level](`Success ${$ms(Date.now() - now)}`)
      return result
    }).catch((error) => {
      fails.add(task)
      throw context.log.fail(`Failure ${$ms(Date.now() - now)}`, error)
    }).finally(async () => {
      await ContextPromises.wait(context)
    }).then(async (result) => {
      for (const after of task.after) await after.invoke(state, after.name)
      return result
    })

    /* Cache the resulting promise and return it */
    cache.set(task, promise)
    return promise
  }

  /* Create the new Task. The function will simply create an empty state */
  const task: Task = Object.assign((overrideProps: Props = {}) => {
    const state: State = {
      cache: new Map<Task, Promise<Result>>(),
      stack: [] as Task[],
      props: Object.assign({}, props, overrideProps),
      fails: new Set<Task>,
      tasks: tasks,
    }
    return invoke(state, _name)
  }, { buildFile, tasks, props, invoke, before: [], after: [] })

  /* Assign the task's marker and name and return it */
  Object.defineProperty(task, taskMarker, { value: true })
  Object.defineProperty(task, 'name', { value: _name })
  return task
}

/* ========================================================================== *
 * BUILD COMPILER                                                             *
 * ========================================================================== */

/**
 * Symbol indicating that an object is a {@link Build}.
 *
 * In a compiled {@link Build} this symbol will be associated with a function
 * taking an array of strings (task names) and record of props to override
 */
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
    if (isTask(val)) { // this goes first, tasks _are_ functions!
      tasks[key] = val
      len = key.length
    } else if (typeof val === 'string') {
      props[key] = val
    } else if (typeof val === 'function') {
      tasks[key] = makeTask(buildFile, tasks, props, val, key)
      len = key.length
    }

    /* Update the logger's own "taskLength" for nice printing */
    /* coverage ignore if */
    if (len > logOptions.taskLength) logOptions.taskLength = len
  }

  /* Create the "call" function for this build */
  const invoke = async function invoke(
      taskNames: string[],
      overrideProps: Record<string, string | undefined> = {},
  ): Promise<void> {
    /* Our "root" logger and initial (empty) state */
    const logger = getLogger()
    const state = {
      cache: new Map<Task, Promise<Result>>(),
      props: Object.assign({}, props, overrideProps),
      fails: new Set<Task>(),
      stack: [] as Task[],
      tasks: tasks,
    }

    /* Let's go down to business */
    logger.notice('Starting...')
    const now = Date.now()

    try {
      /* Run tasks _serially_ */
      for (const name of taskNames) {
        const task = tasks[name]
        assert(task, `Task ${$t(name)} not found in build ${$p(buildFile)}`)
        await task.invoke(state, name)
      }
      logger.notice(`Build successful ${$ms(Date.now() - now)}`)
    } catch (error) {
      if (state.fails.size) {
        logger.error('')
        logger.error(state.fails.size, state.fails.size === 1 ? 'task' : 'tasks', 'failed:')
        state.fails.forEach((task) => logger.error($gry('*'), $t(task.name)))
        logger.error('')
      }
      throw logger.fail(`Build failed ${$ms(Date.now() - now)}`, error)
    }
  }

  /* Create our build, the collection of all props and tasks */
  const compiled = Object.assign(Object.create(null), props, tasks) as Build<D>

  /* Sneak our "call" function in the build, for the CLI and "call" below */
  Object.defineProperty(compiled, buildMarker, { value: invoke })

  /* All done! */
  return compiled
}

/** Check if the specified build is actually a {@link Build} */
export function isBuild(build: any): build is Build<Record<string, any>> {
  return build && typeof build[buildMarker] === 'function'
}

/** Invoke a number of tasks in a {@link Build} */
export function invokeTasks(
    build: Build,
    tasks: string[],
    props?: Record<string, string>,
): Promise<void> {
  if (build && (typeof build === 'object') &&
     (buildMarker in build) && (typeof build[buildMarker] === 'function')) {
    return build[buildMarker](tasks, props)
  } else {
    throw new TypeError('Invalid build instance')
  }
}

/* ========================================================================== *
 * HOOKS                                                                      *
 * ========================================================================== */

type TaskNames<B extends Build> = keyof {
  [ name in keyof B as B[name] extends Task ? name : never ] : any
}

export function hookBefore<B extends Build, T extends keyof B>(
    build: B,
    taskName: string & T & TaskNames<B>,
    hooks: (string & Exclude<TaskNames<B>, T>)[],
): void {
  const task = build[taskName]
  assert(isTask(task), `Task "${$t(taskName)}" not found in build`)

  for (const hook of hooks) {
    const beforeHook = build[hook]
    assert(isTask(beforeHook), `Task "${$t(hook)}" to hook before "${$t(taskName)}" not found in build`)
    if (task.before.includes(beforeHook)) continue
    task.before.push(beforeHook)
  }
}

export function hookAfter<B extends Build, T extends keyof B>(
    build: B,
    taskName: string & T & TaskNames<B>,
    hooks: (string & Exclude<TaskNames<B>, T>)[],
): void {
  const task = build[taskName]
  assert(isTask(task), `Task "${$t(taskName)}" not found in build`)

  for (const hook of hooks) {
    const afterHook = build[hook]
    assert(isTask(afterHook), `Task "${$t(hook)}" to hook after "${$t(taskName)}" not found in build`)
    if (task.after.includes(afterHook)) continue
    task.after.push(afterHook)
  }
}
