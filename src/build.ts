import { file } from '@babel/types'
import assert from 'node:assert'
import { existsSync, statSync } from 'node:fs'
import { Files } from './files'
import { registerTask } from './log'
import { AbsolutePath, assertAbsolutePath, getAbsoluteParent } from './paths'
import { Pipe } from './pipe'
import { initRun, Run, RunImpl } from './run'
import { Task, TaskImpl } from './task'
import { findCaller } from './utils/caller'

/* ========================================================================== *
 * TYPES                                                                      *
 * ========================================================================== */

/**
 * The {@link BuildContext} interface exposes the _internal_ representation of
 * a build file, including all {@link Task}s.
 */
export type BuildContext = {
  /** The absolute file name of the build */
  readonly buildFile: AbsolutePath,
  /** For convenience, the directory of the build file */
  readonly buildDir: AbsolutePath,
  /** A record of all tasks keyed by name */
  readonly tasks: Readonly<Record<string, Task>>
}

/**
 * A {@link TaskDefinition} is a _function_ defining a {@link Task}.
 */
export type TaskDefinition<B> = (this: ThisBuild<B>, self: ThisBuild<B>, run: Run) =>
  Files | void | Promise<Files | void>

/**
 * A {@link TaskCall} describe a _function_ calling a {@link Task}, and
 * it is exposed to outside users of the build.
 */
export type TaskCall = ((baseDir?: AbsolutePath) => Promise<Files>) & { task: Task }

/**
 * A {@link Build} is a collection of {@link TaskCall}s, as produced by the
 * {@link build} function from a {@link BuildDefinition}.
 */
export type Build<B> = {
  [ K in keyof B ] : TaskCall
}

/**
 * The type supplied as `this` to a {@link TaskDefinition} when invoking it.
 */
export type ThisBuild<B> = {
  [ K in keyof B ] : () => Pipe
}

/**
 * A {@link BuildDefinition} is a collection of {@link TaskDefinition}s
 * that the {@link build} function will use to prepare a {@link Build}.
 *
 * A {@link BuildDefinition} can also include other {@link TaskCall}s, thus
 * giving the ability to extend other {@link Build}s.
 */
export type BuildDefinition<B> = {
  [ K in keyof B ] : TaskDefinition<B> | TaskCall
}

/* ========================================================================== *
 * BUILD                                                                      *
 * ========================================================================== */

/** Create a new {@link Build} from its {@link BuildDefinition}. */
export function build<D extends BuildDefinition<D>>(
  definition: D & ThisType<ThisBuild<D>>
): Build<D> {
  /* Basic setup */
  const buildFile = findCaller(build).file
  const buildDir = getAbsoluteParent(buildFile)
  const tasks: Record<string, Task> = {}

  const context: BuildContext = { buildFile, buildDir, tasks }
  const result: Build<any> = {}

  /* Loop through all the definitions */
  for (const name in definition) {
    /* Each  entry in our definition is a `TaskDefinition` or `TaskCall` */
    const def = definition[name]
    const task: Task = 'task' in def ? def.task : new TaskImpl(context, def)

    /* Prepare the _new_ `TaskCall` that will wrap our `Task` */
    const call = ((baseDir?: AbsolutePath) => initRun(context, baseDir).call(name)) as TaskCall

    /* Inject all the properties we need to make a function a `TaskCall` */
    Object.defineProperties(call, {
      name: { enumerable: true, value: name },
      task: { enumerable: true, value: task },
    })

    registerTask(name)
    tasks[name] = task
    result[name] = call
  }

  /* All done! */
  return result
}
