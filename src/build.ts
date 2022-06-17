import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

import { Files } from './files'
import { log, prettyfyTaskName } from './log'
import { Pipe } from './pipe'
import { Run } from './run'

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
  pipe(files?: Files): Pipe
  find(...globs: ParseOptions<FindOptions>): Pipe
  call(...tasks: (keyof D)[]): Pipe
  parallel(...tasks: (keyof D)[]): Pipe
}

/* A `TaskCall` defines the callable component of a `Task` */
export type TaskCall = (build: Build<any>, run: Run) => Promise<Files>

/** A `TaskDefinition` is a _function_ defining a `Task` */
export type TaskDefinition<D> = (this: TaskContext<D>, run: Run) =>
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
    const context = new TaskContextImpl(run, build, file)

    /* Get the results calling the task */
    const result = await definition.call(context, run)

    /* Any pipe created by calling this.xxx(...) gets awaited */
    for (const pipe of context.pipes) await pipe

    /* Check for simple `Files` (or `void`) results */
    return result ? result : Files.builder(run.directory).build()
  }
}



class TaskContextImpl implements TaskContext<any> {
  #pipes: Pipe[] = []
  #build: Build<any>
  #file: string
  #run: Run

  constructor(run: Run, build: Build<any>, file: string) {
    this.#build = build
    this.#file = file
    this.#run = run
  }

  get pipes(): Pipe[] {
    return this.#pipes
  }

  resolve(file: string) {
    return path.resolve(path.dirname(this.#file), file)
  }

  pipe(files?: Files): Pipe {
    const pipe = new Pipe(this.#run, files)
    this.#pipes.push(pipe)
    return pipe
  }

  find(...args: ParseOptions<FindOptions>): Pipe {
    const { globs, options: opts } = parseOptions(args, {})

    return this.pipe().plug(async (run: Run): Promise<Files> => {
      const { directory: dir, ...options } = opts
      const directory = dir ? dir : run.directory

      log.debug('Finding files', { directory, options, globs })

      const files = Files.builder(directory)
      for await (const file of walk(directory, ...globs, options)) {
        files.push(file)
      }

      return files.build()
    })
  }

  call(...names: string[]): Pipe {
    return this.pipe().plug(async (run: Run): Promise<Files> => {
      const files = Files.builder(run.directory)
      if (names.length === 0) return files.build()

      const tasks = names.map((name) => {
        const task = this.#build[name]
        if (! task) run.fail('TODO', `No such task "${name}"`) // TODO
        return task
      })

      const message = names.map((name) => prettyfyTaskName(name)).join(', ')
      log.info('Calling', tasks.length, `tasks in series: ${message}.`)

      for (const task of tasks) {
        files.merge(await run.run(task, this.#build))
      }
      return files.build()
    })
  }

  parallel(...names: string[]): Pipe {
    const pipe = new Pipe(this.#run).plug(async (run: Run): Promise<Files> => {
      const files = Files.builder(run.directory)
      if (names.length === 0) return files.build()

      const tasks = names.map((name) => {
        const task = this.#build[name]
        if (! task) run.fail('TODO', `No such task "${name}"`) // TODO
        return task
      })

      const message = names.map((name) => prettyfyTaskName(name)).join(', ')
      log.info('Calling', tasks.length, `tasks in parallel: ${message}.`)

      const promises: Promise<Files>[] = []
      for (const task of tasks) {
        promises.push(run.run(task, this.#build))
      }

      const results = await Promise.allSettled(promises)
      let errors = 0
      for (const result of results) {
        if (result.status === 'rejected') errors ++
        else files.merge(result.value)
      }

      if (! errors) return files.build()
      run.fail('Parallel execution produced', errors, 'errors')
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
