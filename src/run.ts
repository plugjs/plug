
import assert from 'node:assert'
import path from 'node:path'

import { runAsync } from './async'
import { log, fail } from './log'

import type { Task } from './build'
import type { Files } from './files'

/** A {@link Run} represents the context used when invoking a {@link Task}. */
export class Run {
  #cache: Map<Task, Promise<Files>>
  #directory: string
  #stack: Task[]

  /** Create a {@link Run} with the specified directory (or `process.cwd()`) */
  constructor(directory?: string)
  /** Create a child {@link Run} for a specific {@link Task} */
  constructor(parent: Run, task: Task)
  /* Overloaded implementation */
  constructor(...args: [ string? ] | [ Run, Task ]) {
    if (args[0] instanceof Run) {
      const [ parent, task ] = args
      assert(task, 'No task specified for child run')

      this.#cache = parent.#cache
      this.#directory = parent.#directory
      this.#stack = [ ...parent.#stack, task ]
    } else {
      const directory = args[0] || process.cwd()
      assert(path.isAbsolute(directory), `Directory "${directory}" not absolute`)

      this.#cache = new Map<Task, Promise<Files>>()
      this.#directory = path.normalize(directory)
      this.#stack = []
    }
  }

  /** Return the directory of this {@link Run} */
  get directory(): string {
    return this.#directory
  }

  /** Run the specified {@link Task} in the context of this {@link Run} */
  run(task: Task): Promise<Files> {
    /* Check for circular dependencies */
    if (this.#stack.includes(task)) {
      const m = [ `Circular dependency running task "${task.name}"` ]
      for (const t of this.#stack) m.push(`  - "${t.name}" defined in ${t.file}`)
      m.push(`  * "${task.name}" defined in ${task.file}`)
      throw new Error(m.join('\n'))
    }

    /* Check for cached results */
    const cached = this.#cache.get(task)
    if (cached) return cached

    /* Actually _call_ the `Task` and get a promise for it */
    const promise = runAsync(task, async () => {
      const now = Date.now()
      log.info('Starting task').sep()

      try {
        const result = await task.task(new Run(this, task))
        log.sep().info('Task completed in', Date.now() - now, 'ms')
        return result
      } catch (error) {
        fail(error, 'Task failed in', Date.now() - now, 'ms')
      }
    })

    /* Cache the execution promise (never run the smae task twice) */
    this.#cache.set(task, promise)
    return promise
  }
}
