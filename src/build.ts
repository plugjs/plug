import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

import { Files } from './files'
import { log, prettyfyTaskName } from './log'
import { parseOptions, ParseOptions } from './utils/options'
import { Pipe } from './pipe'
import { Run } from './run'
import { walk, WalkOptions } from './utils/walk'

/* ========================================================================== *
 * TYPES                                                                      *
 * ========================================================================== */

/**
 * The {@link FindOptions} interface defines the options available to
 * {@link TaskContext.find}.
 */
export interface FindOptions extends WalkOptions {
  /** The directory where to start looking for files */
  directory?: string
}

/**
 * The {@link TaskContext} interface describes the value of `this` used
 * when calling {@link TaskDefinition}s.
 */
export interface TaskContext<D> {
  /**
   * Resolve the `file` relative to the file where this {@link TaskDefinition}
   * was specified. If {@link build} is called with {@link Task}s from other
   * {@link Build}s, the _original_ location of the build is preserved.
   */
  resolve(file: string): string
  /** Create a new {@link Pipe} */
  pipe(files?: Files): Pipe
  /** Find files {@link Pipe} with globs */
  find(...globs: ParseOptions<FindOptions>): Pipe
  /** Call the specified {@link Task}s from the current build sequentially */
  call(...tasks: (keyof D)[]): Pipe
  /** Call the specified {@link Task}s from the current build in parallel */
  parallel(...tasks: (keyof D)[]): Pipe
}

/**
 * A {@link TaskDefinition} is a _function_ defining a {@link Task}.
 */
export type TaskDefinition<D> = (this: TaskContext<D>) =>
  | Files | Promise<Files>
  | Pipe | Promise<Pipe>
  | void | Promise<void>

/**
 * The {@link Task} interface describes the members of a {@link Build}.
 */
export interface Task {
  /** The _name_ of this task */
  readonly name: string,
  /** The _file name_ where this task was defined */
  readonly file: string,
  /** The _function_ to invoke to execute this {@link Task} */
  readonly task: () => Promise<Files>
}

/**
 * A callable {@link Task}, or a _function_ contextualizing all that is
 * required to execute a {@link Task}.
 */
export type CallableTask = ((run?: Run) => Promise<Files>) & Readonly<Task>

/**
 * A {@link Build} is a collection of {@link CallableTask}s, as produced by
 * {@link build} from a {@link BuildDefinition}.
 */
export type Build<B> = {
  [ K in keyof B ] : CallableTask
}

/**
 * A {@link BuildDefinition} is a collection of {@link TaskDefinition}s
 * that {@link build} will use to prepare a {@link Build}.
 *
 * A {@link BuildDefinition} can also include other {@link Task}s, inherited
 * from other {@link Build}s.
 */
export type BuildDefinition<B> = {
  [ K in keyof B ] : TaskDefinition<B> | CallableTask
}

/* ========================================================================== *
 * BUILD                                                                      *
 * ========================================================================== */

/** Create a new {@link Build} from its {@link BuildDefinition}. */
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
        [ makeTaskCall(value, build, source), source ]

    /* Create our `TaskDescriptor` (for type checking) */
    const descriptor: Task = { name, file, task } // TODO , build }

    /* Crate the task function, and merge its descriptor properties */
    const call = ((run = new Run()) => run.run(call)) as CallableTask
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

/** Take a {@link TaskDefinition} and return a {@link Task.task} function. */
function makeTaskCall(
  definition: TaskDefinition<any>,
  build: Build<any>,
  file: string,
): () => Promise<Files> {
  return async function task(): Promise<Files> {
    const pipes: Pipe[] = []
    const directory = path.dirname(file)

    /* Create a `TaskContext` instance to call the `TaskDefinition` */
    const context = new class implements TaskContext<any> {
      resolve(file: string) {
        return path.resolve(directory, file)
      }

      pipe(files?: Files): Pipe {
        const pipe = new Pipe(files)
        pipes.push(pipe)
        return pipe
      }

      find(...args: ParseOptions<FindOptions>): Pipe {
        const { globs, options: opts } = parseOptions(args, {})

        return this.pipe().plug(async (run: Run): Promise<Files> => {
          const { directory, ...options } = { directory: run.directory, ...opts }

          log.debug('Finding files', { directory, options, globs })

          const builder = Files.builder(directory)
          for await (const file of walk(builder.directory, ...globs, options)) {
            builder.push(file)
          }

          return builder.build()
        })
      }

      call(...names: string[]): Pipe {
        return this.pipe().plug(async (run, files): Promise<Files> => {
          if (names.length === 0) return files

          const tasks = names.map((name) => {
            const task = build[name]
            if (! task) run.fail(`No such task "${name}"`)
            return task
          })

          const message = names.map((name) => prettyfyTaskName(name)).join(', ')
          log.info('Calling', tasks.length, `tasks in series: ${message}.`)

          const builder = files.builder()
          for (const task of tasks) builder.merge(await run.run(task))
          return builder.build()
        })
      }

      parallel(...names: string[]): Pipe {
        const pipe = new Pipe().plug(async (run, files): Promise<Files> => {
          if (names.length === 0) return files

          const tasks = names.map((name) => {
            const task = build[name]
            if (! task) run.fail(`No such task "${name}"`)
            return task
          })

          const message = names.map((name) => prettyfyTaskName(name)).join(', ')
          log.info('Calling', tasks.length, `tasks in parallel: ${message}.`)

          const promises: Promise<Files>[] = []
          for (const task of tasks) {
            promises.push(run.run(task))
          }

          let errors = 0
          const builder = files.builder()
          const results = await Promise.allSettled(promises)
          for (const result of results) {
            if (result.status === 'rejected') errors ++
            else builder.merge(result.value)
          }

          if (errors) run.fail('Parallel execution produced', errors, 'errors')
          return builder.build()
        })

        pipes.push(pipe)
        return pipe
      }
    }


    /* Call the `TaskDefinition` and await for results */
    const result = await definition.call(context)

    /* Any pipe created by calling this.xxx(...) gets awaited, too */
    for (const pipe of pipes) await pipe

    /* Return the result (or an empty `Files`) */
    return result ? result : new Files()
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
