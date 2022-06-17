
import type { Build, TaskDescriptor } from './build'
import type { Files } from './files'
import { log, runWithTaskName } from './log'

export const buildFailed = Symbol('Build failed')

/** A `Run` represents the context used when invoking a `Task` */
export class Run {
  #directory: string
  #stack: TaskDescriptor[] = []
  #cache: Map<TaskDescriptor, Promise<Files>> = new Map()

  constructor(directory: string = process.cwd()) {
    this.#directory = directory
  }

  get directory(): string {
    return this.#directory
  }

  /** Run the specified `Task` in this `Run` context */
  run(task: TaskDescriptor, build: Build<any>): Promise<Files> {
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

    /* Actually _call_ the `Task` and cache its results */
    const promise = runWithTaskName(task.name, async () => {
      const now = Date.now()
      log.info('Starting')
      try {
        const result = await task.task(build, run)
        log.info('Completed in', Date.now() - now, 'ms')
        return result
      } catch (error) {
        log.info('Completed in', Date.now() - now, 'ms with errors')
        if (error !== buildFailed) log.error(error)
        throw buildFailed
      } finally {
      }
    })
    this.#cache.set(task, promise)
    return promise
  }
}
