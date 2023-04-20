import { AsyncLocalStorage } from 'node:async_hooks'

import { assert } from './asserts'
import { getSingleton } from './utils/singleton'

import type { Context } from './pipe'

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
 * Returns the {@link Context} associated with the current asynchronous
 * invocation context or `undefined`.
 */
export function currentContext(): Context | undefined {
  return storage.getStore()
}

/**
 * Returns the {@link Context} associated with the current asynchronous
 * invocation context and fail if none was found.
 */
export function requireContext(): Context {
  const context = storage.getStore()
  assert(context, 'Unable to retrieve current context')
  return context
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

/* Storage and task names must be unique _per process_ */
const storageKey = Symbol.for('plugjs.plug.async.storage')
const tasksKey = Symbol.for('plugjs.plug.async.tasks')

const storage = getSingleton(storageKey, () => new AsyncLocalStorage<Context>())
const tasks = getSingleton(tasksKey, () => new Set<string>())
