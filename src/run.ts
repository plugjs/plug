import { runAsync } from './async'
import { fail, log } from './log'

import { BuildContext } from './build'
import type { Files } from './files'
import { AbsolutePath } from './paths'
import type { Task } from './task'

/** A {@link Run} represents the context used when invoking a {@link Task}. */
export class Run {
  private readonly _cache: Map<Task, Promise<Files>>
  private readonly _stack: readonly Task[]
  readonly baseDir: AbsolutePath

  constructor(baseDir: AbsolutePath)
  constructor(parent: Run, task: Task)
  constructor(...args: [ baseDir: AbsolutePath ] | [ parent: Run, task: Task ]) {
    if (args.length == 2) {
      const [ parent, task ] = args
      this.baseDir = parent.baseDir
      this._cache = parent._cache
      this._stack = [ ...parent._stack, task ]
    } else {
      this.baseDir = args[0]
      this._cache = new Map<Task, Promise<Files>>()
      this._stack = []
    }
  }

  /** Run the specified {@link Task} in the context of this {@link Run} */
  call(task: Task, context: BuildContext): Promise<Files> {
    /* Check for circular dependencies */
    if (this._stack.includes(task)) {
      const m = [ `Circular dependency running task "${task.name}"` ]
      for (const t of this._stack) {
        const file = t.buildFile
        m.push(`  - "${t.name}" defined in ${t.buildFile}`)
      }
      // coverage ignore next
      m.push(`  * "${task.name}" defined in ${task.buildFile}`)
      throw new Error(m.join('\n'))
    }

    /* Check for cached results */
    const cached = this._cache.get(task)
    if (cached) return cached

    /* Actually _call_ the `Task` and get a promise for it */
    const promise = runAsync(task, async () => {
      const now = Date.now()
      log.sep().info('Starting task').sep()

      /* coverage ignore catch */
      try {
        const run = new Run(this, task)
        const result = await task.call(run, context)

        log.sep().info('Task completed in', Date.now() - now, 'ms').sep()
        return result
      } catch (error) {
        fail(error, 'Task failed in', Date.now() - now, 'ms')
      }
    })

    /* Cache the execution promise (never run the smae task twice) */
    this._cache.set(task, promise)
    return promise
  }
}
