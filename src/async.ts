import { AsyncLocalStorage } from 'node:async_hooks'
import { Run } from './run.js'

/* ========================================================================== *
 * EXPORTED                                                                   *
 * ========================================================================== */

/**
 * Run the specified `callback` associating the specified {@link Run} and task
 * name with the current asynchronous invocation context.
 */
export function runAsync<T>(run: Run, task: string, callback: () => Promise<T>): Promise<T> {
  return storage.run({ run, task }, () => {
    tasks.push(task)
    return callback().finally(() => {
      const index = tasks.lastIndexOf(task)
      if (index >= 0) tasks.splice(index, 1)
    })
  })
}

/**
 * Returns the _task name_ associated with the current asynchronous invocation
 * context or `undefined`.
 */
export function currentTask(): string | undefined {
  return storage.getStore()?.task
}

/**
 * Returns the {@link Run} associated with the current asynchronous invocation
 * context or `undefined`.
 */
export function currentRun(): Run | undefined {
  return storage.getStore()?.run
}

/**
 * Return an array of all _task names_ currently running
 */
export function runningTasks(): string[] {
  return [ ...tasks ].sort()
}

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

const storage = new AsyncLocalStorage<{ run: Run, task: string }>()
const tasks: string[] = []
