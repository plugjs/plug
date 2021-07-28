import { Project } from './project'
import { makeLog } from './utils/log'

import type { Files } from './files'
import type { Log } from './utils/log'
import type { Plug } from './pipe'
import type { Task, TaskCache } from './task'

import { DirectoryPath } from './utils/paths'

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

  #caches: Map<Task | undefined, Partial<TaskCache>>
  #cache?: Partial<TaskCache>
  #log?: Log

  // Parent run and current task for derived runs
  #parent?: Run
  #task?: Task

  // Run ID and project for root runs
  project: Project
  tasks: readonly Task[]
  directory: DirectoryPath

  constructor(project: Project)
  constructor(run: Run, task: Task)
  constructor(first: Project | Run, task?: Task) {
    const { project, run } =
        first instanceof Run ?
            { project: first.project, run: first } :
            { project: first, run: undefined }

    if (run) {
      this.#parent = run
      this.#task = task
      this.#caches = run.#caches

      this.project = run.project
      this.directory = run.directory
      this.tasks = Object.freeze([ ...run.tasks, task! ])
    } else {
      this.#caches = new Map()

      this.project = project
      this.directory = project.directory
      this.tasks = Object.freeze([])
    }

    Object.freeze(this)
  }

  get cache(): Partial<TaskCache> {
    if (this.#cache) return this.#cache

    let taskCache = this.#caches.get(this.#task)
    if (! taskCache) this.#caches.set(this.#task, taskCache = {})

    if (! this.#parent) return this.#cache = taskCache

    const parentCache: Record<string, any> = this.#parent.cache
    return this.#cache = new Proxy(taskCache, {
      has: (target, key: string) => key in target,
      get: (target, key: keyof TaskCache) => target[key] || parentCache[key],
      set: (target, key: keyof TaskCache, value) => target[key] = value,
    })
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
    const taskName = this.#task ? this.project.getTaskName(this.#task) : undefined
    throw new Failure(taskName, message)
  }
}

/** The `Runnable` interface defines a way to produce `Files` for a `Run` */
export interface Runnable {
  run(run: Run): Files | Promise<Files>
}
