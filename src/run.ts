
import { runAsync } from './async'
import type { Task } from './build'
import { fail } from './fail'
import type { Files } from './files'
import { log } from './log'

/** A `Run` represents the context used when invoking a `Task` */
export class Run {
  #directory: string
  #stack: Task[] = []
  #cache: Map<Task, Promise<Files>> = new Map()

  /** Create a `Run` with the specified base directory (default `process.cwd()`) */
  constructor(directory: string = process.cwd()) {
    this.#directory = directory
  }

  /** Return the base directory of this `Run` */
  get directory(): string {
    return this.#directory
  }

  /** Run the specified `TaskDescriptor` in this `Run` context */
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

    /* Prepare a child run */
    const run = new Run(this.#directory)
    run.#stack = [ ...this.#stack, task ]
    run.#cache = this.#cache

    /* Actually _call_ the `Task` and get a promise for it */
    const promise = runAsync({ run, task }, async () => {
      const now = Date.now()
      log.info('Starting task')
      try {
        const result = await task.task()
        log.info('Task completed in', Date.now() - now, 'ms')
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
