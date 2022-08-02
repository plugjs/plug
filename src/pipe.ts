import type { Files } from './files'
import type { Run } from './run'
import { ConstructorArguments } from './types'

/**
 * The {@link Plug} interface describes an extension mechanism for our build.
 */
export interface Plug {
  pipe(files: Files, run: Run): Files | Promise<Files>
}

/**
 * A type identifying a {@link Plug} as a `function`
 */
export type PlugFunction = Plug['pipe']

/**
 * A {@link Pipe} represents a sequence of operations performed by
 * a series of {@link Plug Plugs}.
 */
export interface Pipe extends Promise<Files> {
  /** Add a new {@link Plug} to the steps of this {@link Pipe} */
  plug(plug: Plug): Pipe
  /** Add a new {@link Plug} to the steps of this {@link Pipe} */
  plug(plug: PlugFunction): Pipe
}

/**
 * Implementation of our {@link Pipe} interface.
 */
export class Pipe implements Pipe {
  readonly #promise: Promise<Files>
  readonly #run: Run

  constructor(start: Promise<Files>, run: Run) {
    this.#promise = start
    this.#run = run
  }

  plug(plug: Plug): Pipe
  plug(plug: PlugFunction): Pipe
  plug(arg: Plug | PlugFunction): Pipe {
    const plug = typeof arg === 'function' ? { pipe: arg } : arg
    const start = this.#promise.then((files) => plug.pipe(files, this.#run))
    return new Pipe(start, this.#run)
  }

  then<T1 = Files, T2 = never>(
      onfulfilled?: ((value: Files) => T1 | PromiseLike<T1>) | null | undefined,
      onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null | undefined,
  ): Promise<T1 | T2> {
    return this.#promise.then(onfulfilled, onrejected)
  }

  catch<T = never>(
      onrejected?: ((reason: any) => T | PromiseLike<T>) | null | undefined,
  ): Promise<T | Files> {
    return this.#promise.catch(onrejected)
  }

  finally(
      onfinally?: (() => void) | null | undefined,
  ): Promise<Files> {
    return this.#promise.finally(onfinally)
  }

  [Symbol.toStringTag] = 'Pipe'
}

/* ========================================================================== *
 * PLUG INSTALLATION (INTERNAL)                                               *
 * ========================================================================== */

/** The names which can be installed as direct plugs. */
export type PlugName = string & Exclude<keyof Pipe, 'plug' | keyof Promise<Files>>

/**
 * A convenience type to easily annotate installed {@link Plug Plugs}.
 *
 * See also {@link install}.
 *
 * ```
 * export class Write implements Plug {
 *   // ... the plug implementation lives here
 * }
 *
 * export const write = install('write', Write)
 *
 * declare module '../pipe' {
 *   export interface Pipe {
 *     write: PipeExtension<typeof Write>
 *   }
 * }
 * ```
 */
export type PipeExtension<T extends new (...args: any) => Plug> =
  (...args: ConstructorArguments<T>) => Pipe

/**
 * Install a {@link Plug} into our {@link Pipe} prototype, and return a static
 * creator function for the {@link Plug} itself.
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
 * export class Write implements Plug {
 *   // ... the plug implementation lives here
 * }
 *
 * export const write = install('write', Write)
 *
 * declare module '../pipe' {
 *   export interface Pipe {
 *     write: PipeExtension<typeof Write>
 *   }
 * }
 * ```
 */
export function install<T extends Plug, C extends new (...args: any) => T>(
    name: PlugName,
    ctor: C,
): (...args: ConstructorArguments<C>) => T {
  /* Create the function to instantiate the Plug */
  const instantiate = function(...args: ConstructorArguments<C>): T {
    // eslint-disable-next-line new-cap
    return new ctor(...args)
  }

  /* Inject the creator within the Pipe prototype */
  Pipe.prototype[name] = function(this: Pipe, ...args: any): Pipe {
    return this.plug(instantiate(...args))
  }

  /* Setup names so that stack traces look better */
  Object.defineProperty(instantiate, 'name', { value: name })
  Object.defineProperty(Pipe.prototype[name], 'name', { value: name })

  /* Return our creator */
  return instantiate
}
