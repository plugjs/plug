import type { Run, Runnable } from './run'
import type { Log } from './utils/log'

import assert from 'assert'

import { Files } from './files'
import { TaskPipe } from './pipe'
import { parallelize } from './utils/parallelize'

/**
 * A `TaskCall` describes a function returning a `TaskPipe`, as a way to
 * extend the execution of a `Task` with new `Pipe` elements.
 */
export type TaskCall = (() => TaskPipe) & {
  readonly task: Task
}

/**
 * The `Task` interface describes a `Runnable` task for a project.
 *
 * Once a `Task` is run, in the context of a `Run`, its results are cached
 * and the same task is never run again.
 */
export interface Task extends Runnable {
  /** The (optional) description of this task */
  readonly description?: string
  run(run: Run, log?: Log): Files | Promise<Files>
}

export interface TaskCache {
  'plug.files': Promise<Files>
}

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

// Task implementation, caching and running task only once
abstract class AbstractTask {
  readonly description?: string

  protected constructor(description?: string) {
    this.description = description || undefined
  }

  run(run: Run): Promise<Files> {
    // Contextualize this run
    run = run.for(this)
    const log = run.log()

    // If we have something cached, return it
    if ('plug.files' in run.taskCache) {
      const cached = run.taskCache['plug.files']
      if (cached) return cached
    }

    // Run this task and log
    const time = log.start()
    const result = this.runTask(run)
        .then((result) => {
          log('Task completed in', time)
          return result
        }, (error) => {
          log.error('Task failed in', time, error)
          throw error
        })

    // Cache the result and return it
    run.taskCache['plug.files'] = result
    return result
  }

  abstract runTask(run: Run): Promise<Files>
}

// Create a `TaskCall` out of a `Task`
function makeCall(task: Task): TaskCall {
  const call = (): TaskPipe => {
    // The initial file list of an extended task pipe is the
    // (possibly cached) result of the task we are wrapping
    return new TaskPipe(task)
  }
  call.task = task
  return call
}

/* ========================================================================== *
 * SIMPLE TASKS                                                               *
 * ========================================================================== */

type TaskSource = TaskPipe | (() => TaskPipe)

// Our simple task, wrapping pipelines or void functions
class SimpleTask extends AbstractTask {
  readonly #source: () => TaskPipe

  constructor(description: string | undefined, source: TaskSource) {
    super(description)
    this.#source = typeof source == 'function' ? source : () => source
  }

  async runTask(run: Run): Promise<Files> {
    return this.#source().run(run)
  }
}

/** Create a new `TaskCall` from the given `TaskSource` */
export function task(source: TaskSource): TaskCall
/** Create a new `TaskCall` from the given `TaskSource` */
export function task(description: string, source: TaskSource): TaskCall

export function task(first: string | TaskSource, optional?: TaskSource): TaskCall {
  // Parse our arguments, the description is optional and precedes anything else
  const { description, source } = typeof first === 'string' ?
      { description: first, source: optional } :
      { description: undefined, source: first }
  assert(source, 'Missing task source')

  // Create our simple task, and return a call
  return makeCall(new SimpleTask(description, source))
}

/* ========================================================================== *
 * PARALLELIZE OTHER TASKS                                                    *
 * ========================================================================== */

type TaskCalls = [ TaskCall, ... TaskCall[] ] | [ Task, ... Task[] ]

// Parallelize task runs
class ParallelTask extends AbstractTask {
  readonly #tasks: readonly Task[]

  constructor(description: string | undefined, tasks: Task[]) {
    super(description)
    this.#tasks = tasks
  }

  async runTask(run: Run, log: Log = run.log()): Promise<Files> {
    // Parallelize the run of each task, get all output filesystems
    const outputs = await parallelize(this.#tasks, (task) => task.run(run, log))

    // Create a new file list cloning our input
    const result = Files.for(run)
    // Each file of each output gets added to our output list (in order)
    outputs.forEach((output) => output.forEach((file) => result.add(file)))
    // Return our combined result list
    return result
  }
}

/** Create a new `TaskCall` parallelizing the execution of other tasks */
export function parallel(...tasks: TaskCalls): TaskCall
/** Create a new `TaskCall` parallelizing the execution of other tasks */
export function parallel(description: string, ...tasks: TaskCalls): TaskCall

export function parallel(first: string | Task | TaskCall, ...calls: (Task | TaskCall)[]): TaskCall {
  // Parse our arguments, the description is optional and precedes anything else
  const { description, list } = typeof first === 'string' ?
    { description: first, list: calls } :
    { description: '', list: [ first, ...calls ] }
  assert(list.length, 'Missing tasks to parallelize')

  // Extract tasks from task calls
  const tasks = list.map((call) => 'task' in call ? call.task : call)

  // Create our parallel task, and return a call
  return makeCall(new ParallelTask(description, tasks))
}
