import assert from 'node:assert'
import { existsSync, statSync } from 'node:fs'

import { Files } from './files'
import { registerTask } from './log'
import { AbsolutePath, assertAbsolutePath, getAbsoluteParent } from './paths'
import { Pipe } from './pipe'
import { Run } from './run'
import { Task, TaskContext, TaskImpl } from './task'

/* ========================================================================== *
 * TYPES                                                                      *
 * ========================================================================== */

export interface BuildContext {
  readonly buildFile: AbsolutePath,
  readonly buildDir: AbsolutePath,
  readonly tasks: Readonly<Record<string, Task>>
}

/**
 * A {@link TaskDefinition} is a _function_ defining a {@link Task}.
 */
export type TaskDefinition<D> = (this: TaskContext<D>) =>
  | Files | Promise<Files>
  | Pipe | Promise<Pipe>
  | void | Promise<void>

/**
 *
 */
export type CallableTask = (() => Promise<Files>) & { task: Task }

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
  [ K in keyof B ] : TaskDefinition<B> | CallableTask
}

/* ========================================================================== *
 * BUILD                                                                      *
 * ========================================================================== */

/** Create a new {@link Build} from its {@link BuildDefinition}. */
export function build<D extends BuildDefinition<D>>(
  definition: D & ThisType<TaskContext<D>>
): Build<D> {
  const buildFile = findCaller()
  const buildDir = getAbsoluteParent(buildFile)
  const tasks: Record<string, Task> = {}

  const context: BuildContext = { buildFile, buildDir, tasks }
  const build: Build<any> = {}

  /* Loop through all the defined tasks */
  for (const name in definition) {
    const value = definition[name]

    const task: Task = 'task' in value ? value.task : new TaskImpl(name, context, value)

    const call = (() => new Run(buildDir).call(task, context)) as CallableTask
    Object.defineProperties(call, {
      name: { enumerable: true, value: name },
      task: { enumerable: true, value: task },
    })

    registerTask(task)
    tasks[name] = task
    build[name] = call
  }

  /* All done! */
  return build
}


/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

function findCaller(): AbsolutePath {
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
    assertAbsolutePath(record.file)
    return record.file
  } finally {
    Error.prepareStackTrace = oldPrepareStackTrace
  }
}
