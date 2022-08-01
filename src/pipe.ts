import type { Files } from './files'
import type { Run } from './run'

/**
 * The {@link Plug} interface describes an extension mechanism for our build.
 */
export interface Plug {
  pipe(files: Files, run: Run): Files | void | Promise<Files | void>
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
  plug(plug: Plug): this
  /** Add a new {@link Plug} to the steps of this {@link Pipe} */
  plug(plug: PlugFunction): this
}

/**
 * Implementation of our {@link Pipe} interface.
 */
export class Pipe implements Pipe {
  #promise: Promise<Files>
  readonly #run: Run

  constructor(start: Files | Promise<Files>, run: Run) {
    this.#promise = Promise.resolve().then(() => start)
    this.#run = run
  }

  plug(plug: Plug): this
  plug(plug: PlugFunction): this
  plug(arg: Plug | PlugFunction): this {
    const plug = typeof arg === 'function' ? { pipe: arg } : arg
    this.#promise = this.#promise.then(async (files) => {
      const result = await plug.pipe(files, this.#run)
      return result ? result : this.#run.files().build()
    })
    return this
  }

  then<T1 = Files, T2 = never>(
      onfulfilled?: ((value: Files) => T1 | PromiseLike<T1>) | null | undefined,
      onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null | undefined,
  ): Promise<T1 | T2> {
    return this.#promise
        .then(onfulfilled, onrejected)
  }

  catch<T = never>(
      onrejected?: ((reason: any) => T | PromiseLike<T>) | null | undefined,
  ): Promise<T | Files> {
    return this.#promise
        .catch(onrejected)
  }

  finally(
      onfinally?: (() => void) | null | undefined,
  ): Promise<Files> {
    return this.#promise
        .finally(onfinally)
  }
}

/* ========================================================================== *
 * PLUG INSTALLATION (INTERNAL)                                               *
 * ========================================================================== */

/** The names which can be installed as direct plugs. */
export type PlugNames = string & Exclude<keyof Pipe, 'plug' | keyof Promise<Files>>

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
 * declare module '../pipe' {
 *   export interface Pipe {
 *     write(...args: ConstructorParameters<typeof Write>): this
 *   }
 * }
 * ```
 */
export function install<PlugName extends PlugNames, PlugExtension extends Plug>(
    name: PlugName,
    ctor: new (...args: Parameters<Pipe[PlugName]>) => PlugExtension,
): (...args: Parameters<Pipe[PlugName]>) => PlugExtension {
  /* Create the function to instantiate the Plug */
  const creator = function(...args: Parameters<Pipe[PlugName]>): PlugExtension {
    // eslint-disable-next-line new-cap
    return new ctor(...args)
  }

  /* Inject the creator within the Pipe prototype */
  Pipe.prototype[name] = function(...args: Parameters<Pipe[PlugName]>): Pipe {
    return this.plug(creator(...args))
  }

  /* Setup names so that stack traces look better */
  Object.defineProperty(creator, 'name', { value: name })
  Object.defineProperty(Pipe.prototype[name], 'name', { value: name })

  /* Return our creator */
  return creator
}
