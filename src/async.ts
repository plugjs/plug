import { AsyncLocalStorage } from 'node:async_hooks'
import { Context } from './pipe'

/* ========================================================================== *
 * EXPORTED                                                                   *
 * ========================================================================== */

/**
 * Run the specified `callback` associating the specified {@link Context} and task
 * name with the current asynchronous invocation context.
 */
export function runAsync<T>(
    context: Context,
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
 * Returns the {@link Context} associated with the current asynchronous invocation
 * context or `undefined`.
 */
export function runContext(): Context | undefined {
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

const storage = new AsyncLocalStorage<Context>()
const tasks = new Set<string>
