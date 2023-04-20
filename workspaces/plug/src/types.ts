import type { Files } from './files'
import type { Pipe } from './index'
import type { AbsolutePath } from './paths'

/**
 * A type describing the ultimate result of a {@link Plug}, {@link Pipe} or
 * {@link Task}, that is either a {@link Files} instance or `undefined`.
 */
export type Result = Files | undefined

/* ========================================================================== *
 * EXECUTION STATE                                                            *
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
  /** All _tasks_ that have failed in this {@link State} */
  readonly fails: Set<Task>
}

/* ========================================================================== *
 * TASKS                                                                      *
 * ========================================================================== */

/**
 * The {@link Task} interface normalizes a task definition, associating it with
 * its build file, its sibling {@link Task}s and available _properties_.
 */
export interface Task<T extends Result = Result> {
  /** The unique ID of this {@link Task} */
  readonly id: number,
  /** The _original_ name of this task */
  readonly name: string
  /** All _properties_ siblings to this {@link Task} */
  readonly props: Props
  /** All {@link Tasks} sibling to this {@link Task} */
  readonly tasks: Tasks
  /** The absolute file name where this {@link Task} was defined */
  readonly buildFile: AbsolutePath,
  /** Other {@link Task}s hooked _before_ this one */
  readonly before: Task[]
  /** Other {@link Task}s hooked _after_ this one */
  readonly after: Task[]
  /** Invoke a task from in the context of a {@link Build} */
  invoke(state: State, taskName: string): Promise<T>
}

/**
 * The {@link TaskResult} type identifies _what_ can be returned by a
 * {@link TaskDef | _task definition_}.
 */
export type TaskResult = Pipe | Files | void | undefined

/** The {@link TaskDef} type identifies the _definition_ of a task. */
export type TaskDef<R extends TaskResult = TaskResult> = () => R | Promise<R>

/** A callable, compiled {@link Task} from a {@link TaskDef} */
export type TaskCall<D extends BuildDef = BuildDef, R extends Result = Result> = {
  (props?: Partial<Props<D>>): Promise<R>
  task: Task<R>
}

/* ========================================================================== *
 * TASKS AND PROPERTIES                                                       *
 * ========================================================================== */

/** A type identifying all _properties_ of a {@link Build}. */
export type Props<D extends BuildDef = BuildDef> = {
  readonly [ k in string & keyof D as D[k] extends string ? k : never ] : string
}

/** A type identifying all _tasks_ in a {@link Build} */
export type Tasks<D extends BuildDef = BuildDef> = {
  readonly [ k in string & keyof D as D[k] extends TaskDef | TaskCall ? k : never ] :
    D[k] extends TaskDef<infer R> ?
      R extends void | undefined ? TaskCall<D, undefined> :
      R extends Pipe | Files ? TaskCall<D, Files> :
      never :
    D[k] extends TaskCall ? D[k] :
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
  [ k : string ] : string | TaskDef | TaskCall
}

/**
 * The type that will be used for `this` when invoking
 * {@link TaskDef | task definitions }.
 */
export type ThisBuild<D extends BuildDef> = {
  readonly [ k in keyof D as k extends string ? k : never ] :
    D[k] extends TaskDef<infer R> ?
      R extends Promise<undefined> | void | undefined ? () => Promise<undefined> :
      R extends Pipe | Files ? () => Pipe :
      never :
    D[k] extends TaskCall<any, infer R> ?
      R extends undefined ? () => Promise<undefined> :
      R extends Files ? () => Pipe :
      never :
    D[k] extends string ?
      string :
    never
}

/**
 * Symbol indicating that an object is a {@link Build}.
 *
 * In a compiled {@link Build} this symbol will be associated with a function
 * taking an array of strings (task names) and record of props to override
 */
export const buildMarker = Symbol.for('plugjs:isBuild')

/**
 * The {@link Build} type represents the collection of {@link Task}s
 * and _properties_ compiled from a {@link BuildDef | build definition}.
 */
export type Build<D extends BuildDef = BuildDef> = Props<D> & Tasks<D> & {
  readonly [buildMarker]: (
    tasks: string[],
    props?: Record<string, string | undefined>,
  ) => Promise<void>
}

/** A type identifying all _task names_ in a {@link Build}. */
export type BuildTasks<B extends Build> = string & keyof {
  [ name in keyof B as B[name] extends Function ? name : never ] : any
}

/** A type identifying a subset of _properties_ for a {@link Build}. */
export type BuildProps<B extends Build> = {
  [ name in keyof B as B[name] extends string ? name : never ]? : string
}
