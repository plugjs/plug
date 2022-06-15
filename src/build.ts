import assert from 'node:assert'
import fs from 'node:fs'

import type { Files } from './files'
import { Run } from './run'

import {
  TaskDefinition,
  ThisTasks,
  TaskCall,
  taskCall,
} from './task'

/* ========================================================================== *
 * EXPORTED                                                                   *
 * ========================================================================== */

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
export type Build<D> = {
  [ K in keyof D ] : Task
}

/** The collection of `Task`s and `TaskDefinition`s defining a `Build` */
export type BuildDefinition<D> = {
  [ K in keyof D ] : TaskDefinition | Task
}

/** Create a new `Build` from its `BuildDefinition` */
export function build<D extends BuildDefinition<D>>(
  definition: D & ThisType<ThisTasks<D>>
): Build<D> {
  const buildFile = findCaller()
  const build: Build<any> = {}

  /* Loop through all the defined tasks */
  for (const name in definition) {
    const value = definition[name]

    /* Here "value" can be a `Task` or `TaskDefinition`, we need a `TaskCall` */
    const [ call, file ] = 'task' in value ? [ value.task, value.file ] :
      [ taskCall(value, buildFile), buildFile ]

    /* Wrap our `TaskCall` in something that (optionally) creates a `Run` */
    const task = ((run = new Run(build)) => run.run(task)) as Task

    /* Make this a proper `Task` */
    Object.defineProperties(task, {
      name: { enumerable: true, configurable: false, value: name },
      file: { enumerable: true, configurable: false, value: file },
      task: { enumerable: true, configurable: false, value: call },
    })

    /* Set the `Task` in our `Build` */
    build[name] = task
  }

  /* All done! */
  return build
}

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

// const asyncTasksStorage = new AsyncLocalStorage<Task>()

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
