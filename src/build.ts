import assert from 'node:assert'
import { dir } from 'node:console'
import fs from 'node:fs'
import path from 'node:path'

import { Files } from './files'
import { log } from './log'
import { Pipe } from './pipe'
import { buildFailed, Run } from './run'

import { parseOptions, ParseOptions } from './utils/options'
import { walk, WalkOptions } from './utils/walk'

/* ========================================================================== *
 * TYPES                                                                      *
 * ========================================================================== */

export interface FindOptions extends WalkOptions {
  directory?: string
}

/** The contextual `this` argument used when callng `TaskDefinition`s */
export interface TaskContext<D> {
  resolve(file: string): string
  find(...globs: ParseOptions<FindOptions>): Pipe
  call(...tasks: (keyof D)[]): Pipe
  parallel(...tasks: (keyof D)[]): Pipe
}

/* A `TaskCall` defines the callable component of a `Task` */
export type TaskCall = (build: Build<any>, run: Run) => Promise<Files>

/** A `TaskDefinition` is a _function_ defining a `Task` */
export type TaskDefinition<D> = (this: TaskContext<D>) =>
  | Files | Promise<Files>
  | Pipe | Promise<Pipe>
  | void | Promise<void>

/* A `TaskDescriptor` defines a descriptor for a `Task` */
export interface TaskDescriptor {
  /** The _name_ of this task */
  name: string,
  /** The _file name_ where this task was defined from */
  file: string,
  /** The `TaskCall` of this `Task` */
  task: TaskCall
}

/** A callable `Task`, merging `TaskDescriptor` and `TaskCall` */
export type Task = ((run?: Run) => Promise<Files>) & Readonly<TaskDescriptor>

/** A `Build` represents a number of compiled `Task`s */
export type Build<B> = {
  [ K in keyof B ] : Task
}

/** The collection of `Task`s and `TaskDefinition`s defining a `Build` */
export type BuildDefinition<B> = {
  [ K in keyof B ] : TaskDefinition<B> | Task
}

/* ========================================================================== *
 * BUILD                                                                      *
 * ========================================================================== */

/** Create a new `Build` from its `BuildDefinition` */
export function build<D extends BuildDefinition<D>>(
  definition: D & ThisType<TaskContext<D>>
): Build<D> {
  const source = findCaller()
  const build: Build<any> = {}

  /* Loop through all the defined tasks */
  for (const name in definition) {
    const value = definition[name]

    /* Here "value" can be a `Task` or `TaskDefinition`, we need a `TaskCall` */
    const [ task, file ] =
      'task' in value ?
        [ value.task, value.file ] :
        [ makeTaskCall(value, source), source ]

    /* Create our `TaskDescriptor` (for type checking) */
    const descriptor: TaskDescriptor = { name, file, task }

    /* Crate the task function, and merge its descriptor properties */
    const call = ((run = new Run()) => run.run(call, build)) as Task
    for (const [ key, value ] of Object.entries(descriptor)) {
      Object.defineProperty(call, key, { enumerable: true, value })
    }

    /* Set the `Task` in our `Build` */
    build[name] = call
  }

  /* All done! */
  return build
}

/* ========================================================================== *
 * TASK CALL AND RELATIVE CONTEXT                                             *
 * ========================================================================== */

/** Take a `TaskDefinition` and return a callable `TaskCall` */
function makeTaskCall(definition: TaskDefinition<any>, file: string): TaskCall {
  return async function task(build: Build<any>, run: Run): Promise<Files> {
    const context = new TaskContextImpl(build, file)

    const result = await definition.call(context)
    console.log('RESULT IS', result)

    for (const pipe of context.pipes) {
      if (pipe !== result) await pipe.run(run)
    }
    // console.log('EXTRA', self.pipes.length, 'PIPES CALLED')

    if (! result) return Files.builder(run.directory).build()
    if (result instanceof Files) return result

    console.log('RUNNING RETURNED PIPE')
    return result.run(run) // todo: pipe might have run already!
  }
}



class TaskContextImpl implements TaskContext<any> {
  #pipes: Pipe[] = []
  #build: Build<any>
  #file: string

  constructor(build: Build<any>, file: string) {
    this.#build = build
    this.#file = file
  }

  get pipes(): Pipe[] {
    return this.#pipes
  }

  resolve(file: string) {
    return path.resolve(path.dirname(this.#file), file)
  }

  find(...args: ParseOptions<FindOptions>): Pipe {
    const { globs, options: opts } = parseOptions(args, {})

    const pipe = new Pipe().plug(async (run: Run): Promise<Files> => {
      const { directory: dir, ...options } = opts
      const directory = dir ? dir : run.directory

      log.debug('Finding files', { directory, options, globs })

      const files = Files.builder(directory)
      for await (const file of walk(directory, ...globs, options)) {
        files.push(file)
      }

      return files.build()
    })

    this.#pipes.push(pipe)
    return pipe
  }

  call(...tasks: string[]): Pipe {
    const pipe = new Pipe().plug(async (run: Run): Promise<Files> => {
      const files = Files.builder(run.directory)
      if (tasks.length === 0) return files.build()

      log.debug('Calling', tasks.length, 'tasks in series', { tasks })

      for (const name of tasks) {
        const task = this.#build[name]

        if (! task) {
          log.error(`No such task "${name}"`)
          throw buildFailed
        }

        files.merge(await run.run(task, this.#build))
      }
      return files.build()
    })

    this.#pipes.push(pipe)
    return pipe
  }

  parallel(...tasks: string[]): Pipe {
    const pipe = new Pipe().plug(async (run: Run): Promise<Files> => {
      const files = Files.builder(run.directory)
      if (tasks.length === 0) return files.build()

      log.debug('Calling', tasks.length, 'tasks in parallel', { tasks })

      const promises: Promise<Files>[] = []
      for (const name of tasks) {
        const task = this.#build[name]

        if (! task) {
          log.error(`No such task "${name}"`)
          promises.push(Promise.reject(buildFailed))
        } else {
          promises.push(run.run(task, this.#build))
        }
      }

      const results = await Promise.allSettled(promises)
      let errors = 0
      for (const result of results) {
        if (result.status === 'fulfilled') {
          files.merge(result.value)
        } else {
          if (result.reason !== buildFailed) log.error(result.reason)
          errors ++
        }
      }

      if (errors) throw buildFailed

      return files.build()
    })

    this.#pipes.push(pipe)
    return pipe
  }
}

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

function findCaller(): string {
  const _old = Error.prepareStackTrace

  try {
    const record: { stack?: string, file?: string } = {}

    Error.prepareStackTrace = (_, stackTraces) => {
      for (const stackTrace of stackTraces) {
        const fileName = stackTrace.getFileName()
        if (fileName == __filename) continue

        if (! fileName) continue
        if (! fs.existsSync(fileName)) continue

        record.file = fileName
        break
      }
    }

    Error.captureStackTrace(record, build)
    record.stack // this is a getter

    assert(record.file, 'Unable to determine build file name')
    assert(fs.statSync(record.file).isFile(), `Build file "${record.file}" not found`)
    return record.file
  } finally {
    Error.prepareStackTrace = _old
  }
}
