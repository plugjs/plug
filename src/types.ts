import type { Files } from './files'
import type { AbsolutePath } from './paths'
import type { Pipe } from './pipe'

/**
 * A type describing the ultimate result of a {@link Plug}, {@link Pipe} or
 * {@link Task}, that is either a {@link Files} instance or `undefined`.
 */
export type Result = Files | undefined

/* ========================================================================== *
 * STATE AND CONTEXT                                                          *
 * ========================================================================== */

/**
 * The {@link State} interface defines a component tracking the current
 * _state_ of a build, caching the result of {@link Task}s, and tracking their
 * invocation stack to avoid infinite loops.
 */
export interface State {
  /** The cache of the result of {@link Task}s execution */
  readonly cache: Map<Task, Promise<Result>>
  /** The current {@link Task} invocation stack (to avoid infinite loops) */
  readonly stack: Task[],
  /** All {@link Tasks} available in this {@link State} */
  readonly tasks: Tasks
  /** All _properties_ available in this {@link State} */
  readonly props: Props
}

/* ========================================================================== *
 * TASKS                                                                      *
 * ========================================================================== */

/**
 * The {@link Task} interface normalizes a task definition, associating it with
 * its build file, its sibling {@link Task}s and available _properties_.
 */
export interface Task<T extends Result = Result> {
  /** All _properties_ siblings to this {@link Task} */
  readonly props: Props
  /** All {@link Tasks} sibling to this {@link Task} */
  readonly tasks: Tasks
  /** The absolute file name where this {@link Task} was defined */
  readonly buildFile: AbsolutePath,
  /** Invoke a task from (possibly) a different {@link Context} */
  invoke(state: State, taskName: string): Promise<T>
}

/**
 * The {@link TaskResult} type identifies _what_ can be returned by a
 * {@link TaskDef | _task definition_}.
 */
export type TaskResult = Pipe | Files | void | undefined

/** The {@link TaskDef} type identifies the _definition_ of a task. */
export type TaskDef<R extends TaskResult = TaskResult> = () => R | Promise<R>

/* ========================================================================== *
 * TASKS AND PROPERTIES                                                       *
 * ========================================================================== */

/** A type identifying all _properties_ of a {@link Context}. */
export type Props<D extends BuildDef = BuildDef> = {
  readonly [ k in string & keyof D as D[k] extends string ? k : never ] : string
}

/** A type identifying all _tasks_ in a {@link Context} */
export type Tasks<D extends BuildDef = BuildDef> = {
  readonly [ k in string & keyof D as D[k] extends TaskDef | Task ? k : never ] :
    D[k] extends TaskDef<infer R> ?
      R extends void | undefined ? Task<undefined> :
      R extends Pipe | Files ? Task<Files> :
      never :
    D[k] extends Task ? D[k] :
    never
}

/* ========================================================================== *
 * BUILD                                                                      *
 * ========================================================================== */

/**
 * The {@link BuildDef} interface describes the _definition_ of a {@link Build},
 * all its properties and tasks.
 */
export interface BuildDef {
  [ k : string ] : string | TaskDef | Task
}

/**
 * The type that will be used for `this` when invoking
 * {@link TaskDef | task definitions }.
 */
export type ThisBuild<D extends BuildDef> = {
  readonly [ k in keyof D ] :
    k extends string ?
      D[k] extends TaskDef<infer R> ?
        R extends Promise<undefined> | void | undefined ? () => Promise<undefined> :
        R extends Pipe | Files ? () => Pipe :
        never :
      D[k] extends Task<infer R> ?
        R extends undefined ? () => Promise<undefined> :
        R extends Files ? () => Pipe :
        never :
      D[k] extends string ?
        string :
      never :
    never
}

/**
 * The {@link Build} type represents the collection of {@link Task}s
 * and _properties_ compiled from a {@link BuildDef | build definition}.
 */
export type Build<D extends BuildDef = BuildDef> = Tasks<D> & Props<D>
