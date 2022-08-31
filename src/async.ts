import { AsyncLocalStorage } from 'node:async_hooks'
import { RunContext } from './types'

/* ========================================================================== *
 * EXPORTED                                                                   *
 * ========================================================================== */

/**
 * Run the specified `callback` associating the specified {@link RunContext} and task
 * name with the current asynchronous invocation context.
 */
export function runAsync<T>(
    context: RunContext,
    taskName: string,
    callback: () => Promise<T>,
): Promise<T> {
  return storage.run(context, async () => {
    try {
      tasks.add(taskName)
      return await callback()
    } finally {
      tasks.delete(taskName)
    }
  })
}

/**
 * Returns the {@link RunContext} associated with the current asynchronous invocation
 * context or `undefined`.
 */
export function runContext(): RunContext | undefined {
  return storage.getStore()
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

const storage = new AsyncLocalStorage<RunContext>()
const tasks = new Set<string>
