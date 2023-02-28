import { AsyncLocalStorage } from 'node:async_hooks'

import { assert } from './asserts'

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
  return getStorage().run(context, async () => {
    try {
      getTasks().add(taskName)
      return await callback()
    } finally {
      getTasks().delete(taskName)
    }
  })
}

/**
 * Returns the {@link Context} associated with the current asynchronous
 * invocation context or `undefined`.
 */
export function currentContext(): Context | undefined {
  return getStorage().getStore()
}

/**
 * Returns the {@link Context} associated with the current asynchronous
 * invocation context and fail if none was found.
 */
export function requireContext(): Context {
  const context = getStorage().getStore()
  assert(context, 'Unable to retrieve current context')
  return context
}

/**
 * Return an array of all _task names_ currently running
 */
export function runningTasks(): string[] {
  return [ ...getTasks() ].sort()
}

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

/*
 * Storage and task names must be unique _per process_. We might get called
 * from two (or three) different versions of this file: the .cjs transpiled one,
 * the .mjs transpiled one (or the .ts dynamically transpiled by ts-loader).
 * In all these cases, we must return the _same_ object, so we store those as
 * a global variables associated with a couple of global symbols
 */
const storageKey = Symbol.for('plugjs.plug.async.storage')
const tasksKey = Symbol.for('plugjs.plug.async.tasks')

function getStorage(): AsyncLocalStorage<Context> {
  let storage: AsyncLocalStorage<Context> = (<any> globalThis)[storageKey]
  if (! storage) {
    storage = new AsyncLocalStorage<Context>()
    ;(<any> globalThis)[storageKey] = storage
  }
  return storage
}

function getTasks(): Set<string> {
  let tasks: Set<string> = (<any> globalThis)[tasksKey]
  if (! tasks) {
    tasks = new Set<string>
    ;(<any> globalThis)[tasksKey] = tasks
  }
  return tasks
}
