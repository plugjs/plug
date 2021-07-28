import { Project } from './project'
import { makeLog } from './utils/log'
import { randomBytes } from 'crypto'

import type { Files } from './files'
import type { Log } from './utils/log'
import type { Plug } from './pipe'
import type { Task } from './task'

import assert from 'assert'

const caches = new WeakMap<RunId, WeakMap<Task, Map<string, any>>>()

/** An `Error` representing a build failure */
class Failure extends Error {
  constructor(taskName?: string, message?: string) {
    const failure = taskName ? `Task "${taskName}" failed` : 'Build failed'
    super(message ? `${failure}: ${message}` : failure)
    this.name = 'Failure'
  }
}

/**
 * The `Run` class describes a contract beteween `Plug`s and `Processor`s
 * and the underlying subsystem actually calling them.
 */
export class Run {
  #logs = new WeakMap<Plug, Log>()
  #log?: Log

  readonly id!: RunId
  readonly tasks!: readonly Task[]
  readonly project!: Project

  constructor(project: Project)
  constructor(run: Run, task: Task)
  constructor(first: Project | Run, task?: Task) {
    const { project, run } =
        first instanceof Run ?
            { project: first.project, run: first } :
            { project: first, run: undefined }

    // Run is inherited from any previous instance, as it's the key to caching
    const id = run ? run.id : new RunId()

    // The list of tasks is copied over from the wrapping run or is empty,
    // then we add our task, and freeze the whole thing (no chances!)
    const tasks = run ? [ ...run.tasks ] : []
    if (task) tasks.push(task)
    Object.freeze(tasks)

    Object.defineProperties(this, {
      'directory': { value: project.directory, enumerable: true },
      'id': { value: id, enumerable: true },
      // non-enumerable...
      'project': { value: project },
      'tasks': { value: tasks },
    })

    // Better be safe than sorry...
    Object.freeze(this)
  }

  log(): Log
  log(plug: Plug): Log
  log(plug?: Plug): Log {
    if (! plug) return this.#log || (this.#log = makeLog(this))
    let log = this.#logs.get(plug)
    if (! log) this.#logs.set(plug, log = makeLog(this, plug))
    return log
  }

  for(task: Task): Run {
    return new Run(this, task)
  }

  fail(message?: string): never {
    const task = this.tasks[this.tasks.length - 1]
    const taskName = task ? this.project.getTaskName(task) : undefined
    throw new Failure(taskName, message)
  }

  get taskCache(): Map<string, any> {
    const task = this.tasks[this.tasks.length - 1]
    assert(task, 'No current task available')

    let cache = caches.get(this.id)
    if (! cache) caches.set(this.id, cache = new WeakMap())

    let map = cache.get(task)
    if (! map) cache.set(task, map = new Map())

    return map
  }
}

/** The `Runnable` interface defines a way to produce `Files` for a `Run` */
export interface Runnable {
  run(run: Run): Files | Promise<Files>
}

// A run id, as an object for weak maps
class RunId {
  #id = randomBytes(8).toString('hex')

  constructor() {
    Object.freeze(this) // not taking any chances...
  }

  toString(): string {
    return this.#id
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.#id
  }
}
