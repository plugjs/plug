import type { Files } from './files'
import type { Logger } from './log'
import type { AbsolutePath } from './paths'
import type { Pipe } from './pipe'
import type { WalkOptions } from './utils/walk'

/** The {@link FindOptions} interface defines the options for finding files. */
export interface FindOptions extends WalkOptions {
  /** The directory where to start looking for files. */
  directory?: string
}

/**
 * A type describing the ultimate result of a {@link Plug}, {@link Pipe} or
 * {@link Task}, that is either a {@link Files} instance or `undefined`.
 */
export type Result = Files | undefined

/* ========================================================================== *
 * PLUGS                                                                      *
 * ========================================================================== */

/**
 * The {@link Plug} interface describes _build plugin_.
 *
 * A {@link Plug} receives a {@link Files} instance in its input (for example
 * a list of _source `.ts` files_) and optionally produces a possibly different
 * list (for example the _compiled `.js` files_).
 */
export interface Plug<T extends Result = Result> {
  pipe(files: Files, run: RunContext): T | Promise<T>
}

/** A type identifying a {@link Plug} as a `function` */
export type PlugFunction<T extends Result> = Plug<T>['pipe']

/* ========================================================================== *
 * RUNNING PIPES                                                              *
 * ========================================================================== */

/**
 * The {@link RunContext} interface defines the context in which a {@link Plug}
 * is invoked.
 */
export interface RunContext {
  /** The _name_ of the task associated with this {@link RunContext}. */
  readonly taskName: string
  /** The absolute file name where the task was defined. */
  readonly buildFile: AbsolutePath,
  /** A {@link Logger} associated with this instance. */
  readonly log: Logger

  /**
   * Resolve a path in the context of this {@link RunContext}.
   *
   * If the path starts with `@...` it is considered to be relative to the
   * _directory containing the build file where the task was defined_, otherwise
   * it will be relative to the {@link process.cwd | current working directory}.
   */
  resolve(...paths: [ string, ...string[] ]): AbsolutePath
}

/**
 * The {@link Runnable} interface defines a component eventually producing
 * a {@link Files} or `undefined` result when executed in a {@link RunContext}.
 */
export type Runnable<T extends Result = Result> = {
  run(): Promise<T>
}

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
}

/* ========================================================================== *
 * TASKS                                                                      *
 * ========================================================================== */

/**
 * The {@link TaskContext} interface defines a collection of {@link Task}s
 * siblings to the one being executed, and a collection of _properties_
 * available to the task.
 */
export interface TaskContext<T extends Tasks = Tasks, P extends Props = Props> {
  /** All {@link Tasks} sibling to the ones being executed */
  readonly tasks: T
  /** All _properties_ available to the current build */
  readonly props: P
}

/**
 * The {@link Task} interface normalizes a task definition, associating it with
 * its build file, its sibling {@link Task}s and available _properties_.
 */
export interface Task<T extends Result = Result> extends TaskContext {
  /** The absolute file name where this {@link Task} was defined */
  readonly buildFile: AbsolutePath,
  /** Invoke a task from (possibly) a different {@link TaskContext} */
  call(state: State, context: TaskContext, taskName: string): Promise<T>
}

/**
 * The {@link TaskResult} type identifies _what_ can be returned by a
 * {@link TaskDef | _task definition_}.
 */
export type TaskResult = Runnable | Files | void | undefined

/** The {@link TaskDef} type identifies the _definition_ of a task. */
export type TaskDef<R extends TaskResult = TaskResult> = () => R | Promise<R>

/* ========================================================================== *
 * TYPES EXTRACTION                                                           *
 * ========================================================================== */

/** A type identifying all _properties_ of a {@link Build}. */
export type Props<D extends BuildDef = BuildDef> = {
  readonly [ k in string & keyof D as D[k] extends string ? k : never ] : string
}

/** A type identifying all _tasks_ in a {@link Build} */
export type Tasks<D extends BuildDef = BuildDef> = {
  readonly [ k in string & keyof D as D[k] extends TaskDef | Task ? k : never ] :
    D[k] extends TaskDef<infer R> ?
      R extends Runnable<infer Result> ? Task<Result> :
      R extends void | undefined ? Task<undefined> :
      R extends Files ? Task<Files> :
      never :
    D[k] extends Task ? D[k] :
    never
}

/** A type mapping all _tasks_ in a {@link Build} with their eventual result */
export type TasksResult<D extends BuildDef, T extends Tasks<D>> = {
  [ k in keyof T ] : T[k] extends Task<infer R> ? R : never
}

/** A type mapping an array of task names in a {@link Build} to their eventual results */
export type TasksResults<D extends BuildDef, T extends Tasks<D>, A extends readonly any[]> =
  A extends readonly [ infer First, ...infer Rest ] ?
    First extends keyof T ?
      [ TasksResult<D, T>[First], ...TasksResults<D, T, Rest>] :
      never :
  A extends readonly [ infer Only ] ?
    Only extends keyof T ?
      [ TasksResult<D, T>[Only] ] :
      never :
  A extends readonly [] ? [] :
  never

/** A type identifying all _property names_ in a {@link Build} */
export type PropName<P extends Props> = string & keyof P

/** A type identifying all _task names_ in a {@link Build} */
export type TaskName<T extends Tasks> = string & keyof T

/** A type identifying all _pipe-able_ tasks of a {@link Build} */
export type PipeName<T extends Tasks> = TaskName<T> & keyof {
  [ k in keyof T as T[k] extends Task<Files> ? k : never ] : Pipe
}

/* ========================================================================== *
 * BUILD                                                                      *
 * ========================================================================== */

/**
 * The {@link BuildDef} interface describes the _definition_ of a
 * {@link Build}, that is the object passed to {@link build} to produce
 * a {@link CompiledBuild}.
 */
export interface BuildDef {
  [ k : string ] : string | TaskDef | Task
}

/**
 * The {@link Build} interface represents the internal structure of a compiled
 * {@link BuildDef | build definition} and is available to its tasks as `this`.
 */
export interface Build<
  D extends BuildDef,
  T extends Tasks<D> = Tasks<D>,
  P extends Props<D> = Props<D>
> extends TaskContext<T, P> {
  /** Return the value of the specified property */
  get<K extends PropName<P>>(prop: K): string
  /** Return the value of the specified property as a _number_ */
  getNumber<K extends PropName<P>>(prop: K): number
  /** Return the value of the specified property as an integer _number_ */
  getInteger<K extends PropName<P>>(prop: K): number
  /** Return the value of the specified property as a _bigint_ */
  getBigInt<K extends PropName<P>>(prop: K): bigint
  /** Return the value of the specified property as a _boolean_ */
  getBoolean<K extends PropName<P>>(prop: K): boolean
  /** Return the value of the specified property as an {@link AbsolutePath} */
  getPath<K extends PropName<P>>(prop: K): AbsolutePath

  /** Find files matching the specified glob pattern */
  find(glob: string): Pipe
  /** Find files matching any of the specified glob patterns */
  find(glob: string, ...globs: string[]): Pipe
  /** Find files matching the specified glob pattern with some matching options */
  find(glob: string, options: FindOptions): Pipe
  /** Find files matching any of the specified glob patterns with some matching options */
  find(glob: string, ...extra: [ ...globs: string[], options: FindOptions]): Pipe

  /** Run a single task asynchronously and return its eventual result */
  run<K extends TaskName<T>>(task: K): Promise<TasksResult<D, T>[K]>

  /** Run several tasks asynchronously in parallel and return their eventual results */
  parallel<A extends readonly TaskName<T>[]>(...tasks: A): Promise<TasksResults<D, T, A>>

  /** Run several tasks asynchronously in series and return their eventual results */
  series<A extends readonly TaskName<T>[]>(...tasks: A): Promise<TasksResults<D, T, A>>

  /** Run a task asynchronously and pipe its results into additional plugs */
  pipe<K extends PipeName<T>>(task: K): Pipe

  /** Merge the output of several asynchronous tasks and pipe all results into additional plugs */
  merge<K extends PipeName<T>>(...tasks: (K | Pipe)[]): Pipe
}

/**
 * The {@link CompiledBuild} type represents the collection of {@link Task}s
 * and _properties_ compiled from a {@link BuildDef | build definition}.
 */
export type CompiledBuild<
  D extends BuildDef = BuildDef,
  T extends Tasks<D> = Tasks<D>,
  P extends Props<D> = Props<D>,
> = Function & (
  (...args:
  | [ ...taskNames: (string & keyof T)[] ]
  | [ ...taskNames: (string & keyof T)[], props: Partial<P> ]
  ) => Promise<void>
) & T & P
