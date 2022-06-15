import assert from 'node:assert'
import { asyncTasksStorage } from './async'

import type { Build, Task } from './build'
import type { Files } from './files'

/** A `Run` represents a context used when invoking a `Task` */
export class Run {
  #build: Build<any>
  #directory: string
  #tasks: Task[] = []
  #cache: Map<Task, Promise<Files>> = new Map()

  constructor(build: Build<any>, directory: string = process.cwd()) {
    this.#build = build
    this.#directory = directory
  }

  get directory(): string {
    return this.#directory
  }

  /** Run the specified `Task` in this `Run` context */
  run(task: Task): Promise<Files>
  run(name: string): Promise<Files>
  run(arg: string | Task): Promise<Files> {
    const task = typeof arg === 'string' ? this.#build[arg] : arg
    assert(task, `Task "${arg}" not found in current build context`)

    /* Check for circular dependencies */
    if (this.#tasks.includes(task)) {
      const m = [ `Circular dependency running task "${task.name}"` ]
      for (const t of this.#tasks) m.push(`  - "${t.name}" defined in ${t.file}`)
      m.push(`  * "${task.name}" defined in ${task.file}`)
      throw new Error(m.join('\n'))
    }

    /* Check for cached results */
    const cached = this.#cache.get(task)
    if (cached) return cached

    /* Prepare a child run */
    const run = new Run(this.#build, this.#directory)
    run.#tasks = [ ...this.#tasks, task ]
    run.#cache = this.#cache

    /* Actually _call_ the `Task` and cache its results */
    const promise = asyncTasksStorage.run(task, () => task.task(run))
    this.#cache.set(task, promise)
    return promise
  }
}
