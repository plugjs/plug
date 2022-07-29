import { AsyncLocalStorage } from 'node:async_hooks'

import type { Task } from './task'

/* ========================================================================== *
 * EXPORTED                                                                   *
 * ========================================================================== */

/**
 * Run the specified `callback` associating the specified {@link Task} with the
 * current asynchronous invocation context.
 */
export function runAsync<T>(task: Task, callback: () => Promise<T>): Promise<T> {
  return storage.run(task, () => {
    tasks.push(task)
    return callback().finally(() => {
      const index = tasks.lastIndexOf(task)
      if (index >= 0) tasks.splice(index, 1)
    })
  })
}

/**
 * Returns the {@link Task} associated with the current asynchronous invocation
 * context or `undefined`.
 */
export function currentTask(): Task | undefined {
  return storage.getStore()
}

/**
 * Return an array of all {@link Task}s currently running
 */
export function runningTasks(): Task[] {
  return [ ...tasks ]
}

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

const storage = new AsyncLocalStorage<Task>()
const tasks = new Array<Task>()
