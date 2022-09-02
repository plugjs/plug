import {
  AbsolutePath,
  commonPath,
  getAbsoluteParent,
  getCurrentWorkingDirectory,
  resolveAbsolutePath,
} from './paths'

import { sep } from 'path'
import { assert } from './assert'
import { requireContext } from './async'
import { Files } from './files'
import { ForkingPlug } from './fork'
import { getLogger, Logger } from './log'

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
export class Pipe extends PipeProto {
  constructor(
      private readonly _context: Context,
      private readonly _run: () => Promise<Files>,
  ) {
    super()
  }

  plug(plug: Plug<Files>): Pipe
  plug(plug: PlugFunction<Files>): Pipe
  plug(plug: Plug<void | undefined>): Promise<undefined>
  plug(plug: PlugFunction<void | undefined>): Promise<undefined>
  plug(arg: Plug<PlugResult> | PlugFunction<PlugResult>): Pipe | Promise<undefined> {
    const plug = typeof arg === 'function' ? { pipe: arg } : arg

    const parent = this
    const context = this._context
    return new Pipe(context, async (): Promise<Files> => {
      const previous = await parent.run()
      const current = await plug.pipe(previous, context)
      assert(current, 'Unable to extend pipe')
      return current
    })
  }

  run(): Promise<Files> {
    return this._run()
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
   *   // other tasks return `Pipe & Promise<Files>` so we can
   *   // direcrly await their result without invoking `run()`
   *   await this.anotherTask1(),
   *   await this.anotherTask2(),
   * ])
   * ```
   */
  static merge(pipes: (Pipe | Files | Promise<Files>)[]): Pipe {
    const context = requireContext()
    return new Pipe(context, async (): Promise<Files> => {
      if (pipes.length === 0) return Files.builder(getCurrentWorkingDirectory()).build()

      const [ first, ...other ] = await Promise.all(pipes.map((pipe) => {
        return 'run' in pipe ? pipe.run() : pipe
      }))

      const firstDir = first.directory
      const otherDirs = other.map((f) => f.directory)

      const directory = commonPath(firstDir, ...otherDirs)

      return Files.builder(directory).merge(first, ...other).build()
    })
  }
}

/* ========================================================================== *
 * PLUG INSTALLATION (NEW)                                                    *
 * ========================================================================== */

/** The names which can be installed as direct plugs. */
export type PlugName = string & Exclude<keyof Pipe, 'plug' | 'run'>

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

/**
 * Install a _forking_ {@link Plug} in the {@link Pipe}, in other words
 * execute the plug in a separate process.
 *
 * As a contract, if the _last non-null_ parameter of the constructor is an
 * object and contains the key `coverageDir`, the process will be forked with
 * the approptiately resolved `NODE_V8_COVERAGE` environment variable.
 *
 * Also, forking plugs require some special attention:
 *
 * * plug functions are not supported, only classes implementing the
 *   {@link Plug} interface can be used with this.
 *
 * * the class itself _MUST_ be exported as the _default_ export for the
 *   `scriptFile` specified below. This is to simplify interoperability between
 *   CommonJS and ESM modules as we use dynamic `import(...)` statements.
 */
export function installForking<Name extends PlugName>(
    plugName: Name,
    scriptFile: AbsolutePath,
): void {
  /** Extend out our ForkingPlug below */
  const ctor = class extends ForkingPlug {
    constructor(...args: any[]) {
      super(scriptFile, args)
    }
  } as unknown as PlugConstructor<Name>

  /** Install the plug in  */
  install(plugName, ctor)
}
