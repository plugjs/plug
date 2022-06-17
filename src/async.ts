import { AsyncLocalStorage } from 'node:async_hooks'

import assert from 'node:assert'
import type { Task } from './build'
import type { Run } from './run'

/* ========================================================================== *
 * EXPORTED                                                                   *
 * ========================================================================== */

/**
 * The {@link AsyncContext} interface describes what needs to be associated
 * with the current asynchronous invocation context.
 */
export interface AsyncContext {
  /** The {@link Run} to associate with the current invocation context */
  run: Run,
  /** The {@link Task} to associate with the current invocation context */
  task: Task,
}

/**
 * Run the specified `callback` associating the specified {@link AsyncContext}
 * with the current asynchronous invocation context.
 *
 * @return The {@link Promise} returned by the callback.
 */
export function runAsync<T>(context: AsyncContext, callback: () => Promise<T>): Promise<T> {
  return storage.run(context, () => {
    tasks.push(context.task)
    return callback().finally(() => {
      const index = tasks.lastIndexOf(context.task)
      if (index >= 0) tasks.splice(index, 1)
    })
  })
}

/**
 * Returns the {@link Run} associated with the current asynchronous invocation
 * context or `undefined`.
 */
export function currentRun(): Run | undefined {
  return storage.getStore()?.run
}

/**
 * Returns the {@link Task} associated with the current asynchronous invocation
 * context or `undefined`.
 */
export function currentTask(): Task | undefined {
  return storage.getStore()?.task
}

/**
 * Returns the {@link Run} associated with the current asynchronous invocation
 * context or `undefined`.
 */
 export function requireRun(): Run {
  const context = storage.getStore()
  assert(context, 'Unable to determine current asynchronous invocation context')
  return context.run
}

/**
 * Returns the {@link Task} associated with the current asynchronous invocation
 * context or `undefined`.
 */
export function requireTask(): Task {
  const context = storage.getStore()
  assert(context, 'Unable to determine current asynchronous invocation context')
  return context.task
}

/**
 * Return the array of all {@link Task}s currently running
 */
export function runningTasks(): Task[] {
  return [ ...tasks ]
}

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

const storage = new AsyncLocalStorage<AsyncContext>()
const tasks = new Array<Task>()
