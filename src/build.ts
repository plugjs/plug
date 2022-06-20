import assert from 'node:assert'
import path from 'node:path'
import { statSync, existsSync } from 'node:fs'

import { Files } from './files'
import { log, fail } from './log'
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
  /**
   * The directory where to start looking for files.
   *
   * @defaultValue The current {@link Run.directory}
   */
   directory?: string
}

/**
 * The {@link TaskContext} interface describes the value of `this` used
 * when calling a {@link TaskDefinition}s.
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
  find(glob: string, ...args: ParseOptions<FindOptions>): Pipe
  /** Call the specified {@link Task}s from the current build sequentially */
  call(...tasks: (keyof D)[]): Pipe
  /** Call the specified {@link Task}s from the current build in parallel */
  parallel(...tasks: (keyof D)[]): Pipe
}

/**
 * A {@link TaskDefinition} is a _function_ defining a {@link Task}.
 */
export type TaskDefinition<D> = (this: TaskContext<D>, run: Run) =>
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
  readonly task: (run: Run) => Promise<Files>
}

/** A {@link TaskCall} defines the type of the {@link Task.task} function. */
export type TaskCall = Task["task"]

/**
 * A callable {@link Task}, or a _function_ contextualizing all that is
 * required to execute a {@link Task}.
 */
export type CallableTask = ((run?: Run) => Promise<Files>) & Readonly<Task>

/**
 * A {@link Build} is a collection of {@link CallableTask}s, as produced by the
 * {@link build} function from a {@link BuildDefinition}.
 */
export type Build<B> = {
  [ K in keyof B ] : CallableTask
}

/**
 * A {@link BuildDefinition} is a collection of {@link TaskDefinition}s
 * that the {@link build} function will use to prepare a {@link Build}.
 *
 * A {@link BuildDefinition} can also include other {@link Task}s, inherited
 * from other {@link Build}s.
 */
export type BuildDefinition<B> = {
  [ K in keyof B ] : TaskDefinition<B> | Task
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

    /* Create our `Task` */
    const descriptor: Task = { name, file, task }

    /* Crate the `CallableTask` function */
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

/* Take a {@link TaskDefinition} and return a {@link TaskCall}. */
function makeTaskCall(
  definition: TaskDefinition<any>,
  build: Build<any>,
  file: string,
): TaskCall {
  return async function task(run: Run): Promise<Files> {
    const pipes: Pipe[] = []
    const directory = path.dirname(file)

    /* Create a `Pipe` that needs to be awaited before this task finishes */
    function createPipe(fn: () => Promise<Files>): Pipe {
      const pipe = new Pipe(run, fn)
      pipes.push(pipe)
      return pipe
    }

    /* Create a `TaskContext` instance to call the `TaskDefinition` */
    const context = new class implements TaskContext<any> {
      resolve(file: string) {
        return path.resolve(directory, file)
      }

      pipe(files: Files = new Files(run)): Pipe {
        return createPipe(() => Promise.resolve(files))
      }

      find(glob: string, ...args: ParseOptions<FindOptions>): Pipe {
        return createPipe(async (): Promise<Files> => {
          const { params, options: { directory, ...options } } =
            parseOptions(args, { directory: run.directory })

          const builder = Files.builder(run, directory)
          const dir = builder.directory // builder.directory is resolved
          const globs = [ glob, ...params ]

          log.debug(`Finding files in "${dir}"`, { globs, options })

          for await (const file of walk(dir, globs, options)) {
            builder.add(file)
          }

          return builder.build()
        })
      }

      call(...names: string[]): Pipe {
        return createPipe(async (): Promise<Files> => {
          if (names.length === 0) return new Files(run)

          const tasks = names.map((name) => {
            const task = build[name]
            if (! task) fail(`No such task "${name}"`)
            return task
          })

          log.info('Calling', tasks.length, 'tasks in series:', ...tasks)

          const builder = Files.builder(run)
          for (const task of tasks) builder.merge(await run.run(task))
          return builder.build()
        })
      }

      parallel(...names: string[]): Pipe {
        return createPipe(async (): Promise<Files> => {
          if (names.length === 0) return new Files(run)

          const tasks = names.map((name) => {
            const task = build[name]
            if (! task) fail(`No such task "${name}"`)
            return task
          })

          log.info('Calling', tasks.length, 'tasks in parallel:', ...tasks)

          const promises: Promise<Files>[] = []
          for (const task of tasks) {
            promises.push(run.run(task))
          }

          let errors = 0
          const builder = Files.builder(run)
          const results = await Promise.allSettled(promises)
          for (const result of results) {
            if (result.status === 'rejected') errors ++
            else builder.merge(result.value)
          }

          if (errors) fail('Parallel execution produced', errors, 'errors')
          return builder.build()
        })
      }
    }

    /* Call the `TaskDefinition` and await for results */
    const result = await definition.call(context, run)

    /* Any pipe created by calling this.xxx(...) gets awaited */
    for (const pipe of pipes) await pipe

    /* Return the result or an empty `Files` */
    return result || new Files(run)
  }
}


/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

function findCaller(): string {
  const oldPrepareStackTrace = Error.prepareStackTrace

  try {
    const record: { stack?: string, file?: string } = {}

    Error.prepareStackTrace = (_, stackTraces) => {
      for (const stackTrace of stackTraces) {
        const fileName = stackTrace.getFileName()
        if (fileName == __filename) continue

        if (! fileName) continue
        if (! existsSync(fileName)) continue

        record.file = fileName
        break
      }
    }

    Error.captureStackTrace(record, build)
    record.stack // this is a getter

    assert(record.file, 'Unable to determine build file name')
    assert(statSync(record.file).isFile(), `Build file "${record.file}" not found`)
    return record.file
  } finally {
    Error.prepareStackTrace = oldPrepareStackTrace
  }
}
