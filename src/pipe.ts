import {
  AbsolutePath,
  commonPath,
  getAbsoluteParent,
  getCurrentWorkingDirectory,
  resolveAbsolutePath,
} from './paths'

import { sep } from 'path'
import { assert, assertPromises } from './assert'
import { requireContext } from './async'
import { Files } from './files'
import { getLogger, Logger } from './log'
import { Result } from './types'

/* ========================================================================== *
 * PLUGS                                                                      *
 * ========================================================================== */

/** A convenience type indicating what can be returned by a {@link Plug}. */
export type PlugResult = Files | undefined | void

/**
 * The {@link Plug} interface describes _build plugin_.
 *
 * A {@link Plug} receives a {@link Files} instance in its input (for example
 * a list of _source `.ts` files_) and optionally produces a possibly different
 * list (for example the _compiled `.js` files_).
 */
export interface Plug<T extends PlugResult> {
  pipe(files: Files, context: Context): T | Promise<T>
}

/** A type identifying a {@link Plug} as a `function` */
export type PlugFunction<T extends PlugResult> = Plug<T>['pipe']

/* ========================================================================== *
 * PLUG CONTEXT                                                               *
 * ========================================================================== */

/**
 * The {@link Context} class defines the context in which a {@link Plug}
 * is invoked.
 */
export class Context {
  /** The directory of the file where the task was defined (convenience). */
  public readonly buildDir: AbsolutePath
  /** The {@link Logger} associated with this instance. */
  public readonly log: Logger

  constructor(
      /** The absolute file name where the task was defined. */
      public readonly buildFile: AbsolutePath,
      /** The _name_ of the task associated with this {@link Context}. */
      public readonly taskName: string,
  ) {
    this.buildDir = getAbsoluteParent(buildFile)
    this.log = getLogger(taskName)
  }

  /**
   * Resolve a (set of) path(s) in this {@link Context}.
   *
   * If the path (or first component thereof) starts with `@...`, then the
   * resolved path will be relative to the directory containing the build file
   * where the current task was defined, otherwise it will be relative to the
   * current working directory.
   */
  resolve(path: string, ...paths: string[]): AbsolutePath {
    // Paths starting with "@" are relative to the build file directory
    if (path && path.startsWith('@')) {
      // We can have paths like "@/../foo/bar" or "@../foo/bar"... both are ok
      const components = path.substring(1).split(sep).filter((s) => !!s)
      return resolveAbsolutePath(this.buildDir, ...components, ...paths)
    }

    // No path? Resolve to the CWD!
    if (! path) return getCurrentWorkingDirectory()

    // For all the rest, normal resolution!
    return resolveAbsolutePath(getCurrentWorkingDirectory(), path, ...paths)
  }
}

/* ========================================================================== *
 * PIPES                                                                      *
 * ========================================================================== */

/**
 * In pipe chains, we want to keep track of the _leaf_ promises (that
 * is, when a derived pipe is created calling `plug` we want to track only the
 * new, derived, promise).
 *
 * We key these _leaf_ promises by _context_ (with a WeakMap), and those will
 * be awaited at the end of the task.
 */
const contextPromises = new WeakMap<Context, ContextPromises>()

/**
 * An internal class recording _hot_ (failure will fail the task) and _cold_
 * (failure will be ignored) {@link Promise}s for a task's {@link Context}.
 */
export class ContextPromises {
  private readonly _cold = new Set<Promise<Result>>()
  private readonly _hot = new Set<Promise<Result>>()

  /* Private constructor */
  private constructor(readonly context: Context) {}

  /** Track a {@link Promise} _hot_ (failure will fail the task) */
  hot(promise: Promise<Result>): void {
    this._cold.delete(promise)
    this._hot.add(promise)
  }

  /** Track a {@link Promise} _cold_ (failure will be ignored) */
  cold(promise: Promise<Result>): void {
    this._hot.delete(promise)
    this._cold.add(promise)
  }

  /**
   * Await all tracked {@link Promise}s, triggering a build failure if any of
   * the _hot_ ones is rejected.
   */
  static async wait(context: Context): Promise<void> {
    const instance = contextPromises.get(context)
    if (! instance) return

    await Promise.allSettled([ ...instance._cold ])
    await assertPromises([ ...instance._hot ])
  }

  /** Get a {@link ContextPromises} instance for the given {@link Context} */
  static get(context: Context): ContextPromises {
    let promises = contextPromises.get(context)
    if (! promises) {
      promises = new ContextPromises(context)
      contextPromises.set(context, promises)
    }
    return promises
  }
}

/**
 * A class that will be extended by {@link Pipe} where {@link install} will
 * add prototype properties from installed {@link Plug}s
 */
abstract class PipeProto {
  abstract plug(plug: Plug<PlugResult>): Pipe | Promise<undefined>
}

/**
 * The {@link Pipe} class defines processing pipeline where multiple
 * {@link Plug}s can transform lists of {@link Files}.
 */
export class Pipe extends PipeProto implements Promise<Files> {
  readonly [Symbol.toStringTag] = 'Pipe'

  constructor(
      private readonly _context: Context,
      private readonly _promise: Promise<Result>,
  ) {
    super()

    // New "Pipe", remember the promise!
    ContextPromises.get(_context).hot(_promise)
  }

  /* ------------------------------------------------------------------------ *
   * Promise implementation                                                   *
   * ------------------------------------------------------------------------ *
   * From a _types_ point of view, the `Pipe` implements a `Promise<Files>`   *
   * (because only when plugging the correct `Plug` the correct value are     *
   * returned).                                                               *
   *                                                                          *
   * Whether to return (as a type) another `Pipe` or a `Promise<undefined>`   *
   * is determined by the type of the `plug` parameter below.                 *
   *                                                                          *
   * That said, in practice, a `Pipe` implements `Promise<Files | undefined>` *
   * because the result of the plug is _eventually_ computed asynchronously   *
   * while `plug` returns immediately.
   *                                                                          *
   * So, all those "as whatever" below are kind-of-legit...                   *
   * ------------------------------------------------------------------------ */

  then<R1 = Files, R2 = never>(
      onfulfilled?: ((value: Files) => R1 | PromiseLike<R1>) | null | undefined,
      onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null | undefined,
  ): Promise<R1 | R2> {
    // We are delegating the handling of this promise to the caller
    ContextPromises.get(this._context).cold(this._promise)
    return this._promise.then(onfulfilled as (value: Result) => R1 | PromiseLike<R1>, onrejected)
  }

  catch<R = never>(
      onrejected?: ((reason: any) => R | PromiseLike<R>) | null | undefined,
  ): Promise<Files | R> {
    // We are delegating the handling of this promise to the caller
    ContextPromises.get(this._context).cold(this._promise)
    return this._promise.catch(onrejected) as Promise<Files | R>
  }

  finally(onfinally?: (() => void) | null | undefined): Promise<Files> {
    // We are delegating the handling of this promise to the caller
    ContextPromises.get(this._context).cold(this._promise)
    return this._promise.finally(onfinally) as Promise<Files>
  }

  /* ------------------------------------------------------------------------ *
   * Pipe implementation                                                      *
   * ------------------------------------------------------------------------ */

  plug(plug: Plug<Files>): Pipe
  plug(plug: PlugFunction<Files>): Pipe
  plug(plug: Plug<void | undefined>): Promise<undefined>
  plug(plug: PlugFunction<void | undefined>): Promise<undefined>
  plug(arg: Plug<PlugResult> | PlugFunction<PlugResult>): Pipe | Promise<undefined> {
    const plug = typeof arg === 'function' ? { pipe: arg } : arg

    // We are creating a new "leaf" Pipe, we can forget our promise
    ContextPromises.get(this._context).cold(this._promise)

    // Create and return the new Pipe
    return new Pipe(this._context, this._promise.then(async (result) => {
      assert(result, 'Unable to extend pipe')
      const result2 = await plug.pipe(result, this._context)
      return result2 || undefined
    }))
  }

  /**
   * Merge the results of several {@link Pipe}s into a single one.
   *
   * Merging is performed _in parallel_. When serial execution is to be desired,
   * we can merge the awaited _result_ of the {@link Pipe}.
   *
   * For example:
   *
   * ```
   * const pipe: Pipe = merge([
   *   await this.anotherTask1(),
   *   await this.anotherTask2(),
   * ])
   * ```
   */
  static merge(pipes: (Pipe | Files | Promise<Files>)[]): Pipe {
    const context = requireContext()
    return new Pipe(context, Promise.resolve().then(async () => {
      // No pipes? Just send off an empty pipe...
      if (pipes.length === 0) return Files.builder(getCurrentWorkingDirectory()).build()

      // Await for all pipes / files / files promises
      const results = await assertPromises<Files>(pipes)

      // Find the common directory between all the Files instances
      const [ firstDir, ...otherDirs ] = results.map((f) => f.directory)
      const directory = commonPath(firstDir, ...otherDirs)

      // Build our new files instance merging all the results
      return Files.builder(directory).merge(...results).build()
    }))
  }
}

/* ========================================================================== *
 * PLUG INSTALLATION (NEW)                                                    *
 * ========================================================================== */

/** The names which can be installed as direct plugs. */
export type PlugName = string & Exclude<keyof Pipe, 'plug' | keyof Promise<any>>

/** The parameters of the plug extension with the given name */
export type PipeParameters<Name extends PlugName> = PipeOverloads<Name>['args']

/** Extract arguments and return types from function overloads. */
type PipeOverloads<Name extends PlugName> =
  Pipe[Name] extends {
    (...args: infer A0): infer R0
    (...args: infer A1): infer R1
    (...args: infer A2): infer R2
    (...args: infer A3): infer R3
    (...args: infer A4): infer R4
  } ?
    | (R0 extends (Pipe | Promise<undefined>) ? { args: A0, ret: R0 } : never)
    | (R1 extends (Pipe | Promise<undefined>) ? { args: A1, ret: R1 } : never)
    | (R2 extends (Pipe | Promise<undefined>) ? { args: A2, ret: R2 } : never)
    | (R3 extends (Pipe | Promise<undefined>) ? { args: A3, ret: R3 } : never)
    | (R4 extends (Pipe | Promise<undefined>) ? { args: A4, ret: R4 } : never)
  :
  Pipe[Name] extends {
    (...args: infer A0): infer R0
    (...args: infer A1): infer R1
    (...args: infer A2): infer R2
    (...args: infer A3): infer R3
  } ?
    | (R0 extends (Pipe | Promise<undefined>) ? { args: A0, ret: R0 } : never)
    | (R1 extends (Pipe | Promise<undefined>) ? { args: A1, ret: R1 } : never)
    | (R2 extends (Pipe | Promise<undefined>) ? { args: A2, ret: R2 } : never)
    | (R3 extends (Pipe | Promise<undefined>) ? { args: A3, ret: R3 } : never)
  :
  Pipe[Name] extends {
    (...args: infer A0): infer R0
    (...args: infer A1): infer R1
    (...args: infer A2): infer R2
  } ?
    | (R0 extends (Pipe | Promise<undefined>) ? { args: A0, ret: R0 } : never)
    | (R1 extends (Pipe | Promise<undefined>) ? { args: A1, ret: R1 } : never)
    | (R2 extends (Pipe | Promise<undefined>) ? { args: A2, ret: R2 } : never)
  :
  Pipe[Name] extends {
    (...args: infer A0): infer R0
    (...args: infer A1): infer R1
  } ?
    | (R0 extends (Pipe | Promise<undefined>) ? { args: A0, ret: R0 } : never)
    | (R1 extends (Pipe | Promise<undefined>) ? { args: A1, ret: R1 } : never)
  :
  Pipe[Name] extends {
    (...args: infer A0): infer R0
  } ?
    | (R0 extends (Pipe | Promise<undefined>) ? { args: A0, ret: R0 } : never)
  : never

/** The parameters of the plug extension with the given name */
type PipeResult<Name extends PlugName> = PipeOverloads<Name>['ret']

/**
 * A type defining the correct constructor for a {@link Plug}, inferring
 * argument types and instance type from the definitions in {@link Pipe}.
 */
type PlugConstructor<Name extends PlugName> =
  PipeResult<Name> extends Pipe ?
    new (...args: PipeParameters<Name>) => Plug<Files> :
  PipeResult<Name> extends Promise<undefined> ?
    new (...args: PipeParameters<Name>) => Plug<void | undefined> :
  PipeResult<Name> extends (Pipe | Promise<undefined>) ?
    new (...args: PipeParameters<Name>) => Plug<Files | void | undefined> :
  never

/**
 * Install a {@link Plug} into our {@link Pipe} prototype.
 *
 * This allows our shorthand syntax for well-defined plugs such as:
 *
 * ```
 * find('./src', '*.ts').write('./target')
 * // Nicer and easier than...
 * find('./src', '*.ts').plug(new Write('./target'))
 * ```
 *
 * Use this alongside interface merging like:
 *
 * ```
 * declare module '@plugjs/plug/pipe' {
 *   export interface Pipe {
 *     write(): Pipe
 *   }
 * }
 *
 * install('write', class Write implements Plug {
 *   constructorg(...args: PipeParams<'write'>) {
 *     // here `args` is automatically inferred by whatever was declared above
 *   }
 *
 *   // ... the plug implementation lives here
 * })
 * ```
 */
export function install<
  Name extends PlugName,
  Ctor extends PlugConstructor<Name>,
>(name: Name, ctor: Ctor): void {
  /* The function plugging the newly constructed plug in a pipe */
  function plug(this: PipeProto, ...args: PipeParameters<Name>): Pipe | Promise<undefined> {
    // eslint-disable-next-line new-cap
    return this.plug(new ctor(...args))
  }

  /* Setup name so that stack traces look better */
  Object.defineProperty(plug, 'name', { value: name })

  /* Inject the create function in the Pipe's prototype */
  Object.defineProperty(PipeProto.prototype, name, { value: plug })
}
