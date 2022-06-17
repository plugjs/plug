
import { runAsync } from './async'
import type { Build, TaskDescriptor } from './build'
import type { Files } from './files'
import { log } from './log'

/** A constant thrown by `Run` indicating a build failure already logged */
export const buildFailed = Symbol('Build failed')

/** A `Run` represents the context used when invoking a `Task` */
export class Run {
  #directory: string
  #stack: TaskDescriptor[] = []
  #cache: Map<TaskDescriptor, Promise<Files>> = new Map()

  /** Create a `Run` with the specified base directory (default `process.cwd()`) */
  constructor(directory: string = process.cwd()) {
    this.#directory = directory
  }

  /** Return the base directory of this `Run` */
  get directory(): string {
    return this.#directory
  }

  get currentTask(): TaskDescriptor | undefined {
    return this.#stack[this.#stack.length - 1]
  }

  get runningTasks(): TaskDescriptor[] {
    return [ ...this.#stack ]
  }

  /** Run the specified `TaskDescriptor` in this `Run` context */
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

    /* Actually _call_ the `Task` and get a promise for it */
    const promise = runAsync({ run, build, task }, async () => {
      const now = Date.now()
      log.info('Starting task')
      try {
        const result = await task.task(build, run)
        log.info('Task completed in', Date.now() - now, 'ms')
        return result
      } catch (error) {
        this.fail(error, 'Task failed in', Date.now() - now, 'ms')
      }
    })

    /* Cache the execution promise (never run the smae task twice) */
    this.#cache.set(task, promise)
    return promise
  }

  /** Fail this `Run` giving a descriptive reason */
  fail(reason: string, ...data: any[]): never
  /** Fail this `Run` for the specified cause, with an optional reason */
  fail(cause: unknown, reason?: string, ...args: any[]): never
  // Overload!
  fail(causeOrReason: unknown, ...args: any[]): never {
    /* We never have to log `buildFailed`, so treat it as undefined */
    if (causeOrReason === buildFailed) causeOrReason = undefined

    /* Nomalize our arguments, extracting cause and reason */
    const [ cause, reason ] =
      typeof causeOrReason === 'string' ?
        [ undefined, causeOrReason ] :
        [ causeOrReason, args.shift() as string | undefined ]

    /* Log our error if we have to */
    if (reason) {
      if (cause) args.push(cause)
      log.error(reason, ...args)
    } else if (cause) {
      log.error('Error', cause)
    }

    /* Failure handled, never log it again */
    throw buildFailed
  }
}
