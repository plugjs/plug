import { AsyncLocalStorage } from 'node:async_hooks'

import type { Run } from './run'

/* ========================================================================== *
 * EXPORTED                                                                   *
 * ========================================================================== */

/**
 * Run the specified `callback` associating the specified {@link Task} with the
 * current asynchronous invocation context.
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
 * Returns the {@link Task} associated with the current asynchronous invocation
 * context or `undefined`.
 */
export function currentTask(): string | undefined {
  return storage.getStore()?.task
}

export function currentRun(): Run | undefined {
  return storage.getStore()?.run
}

/**
 * Return an array of all {@link Task}s currently running
 */
export function runningTasks(): string[] {
  return [ ...tasks ]
}

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

const storage = new AsyncLocalStorage<{ run: Run, task: string }>()
const tasks: string[] = []
