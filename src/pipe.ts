import { assert } from './assert.js'
import { Files } from './files.js'
import { Run } from './run.js'

/**
 * The {@link Plug} interface describes an extension mechanism for our build.
 */
export interface Plug<T extends Files | undefined> {
  pipe(files: Files, run: Run): T | Promise<T>
}

/**
 * A type identifying a {@link Plug} as a `function`
 */
export type PlugFunction<T extends Files | undefined> = Plug<T>['pipe']

/**
 * A {@link Pipe} represents a sequence of operations performed by
 * a series of {@link Plug | Plugs}.
 */
export interface Pipe {
  /* Left empty, for definitions of installed plugs as extensions */
}

/**
 * The {@link Pipe} abstract class exposes the prototype upon which all
 * extension plugs will be installed on.
 */
export abstract class Pipe implements Pipe {
  abstract plug(plug: Plug<Files> | PlugFunction<Files>): Pipe & Promise<Files>
  abstract plug(plug: Plug<undefined> | PlugFunction<undefined>): Promise<undefined>
}


/** Implementation of our {@link Pipe}. */
export class PipeImpl<T extends Files | undefined> extends Pipe implements Promise<T> {
  readonly #promise: Promise<T>
  readonly #run: Run

  constructor(start: T | Promise<T>, run: Run) {
    super()
    this.#promise = Promise.resolve(start)
    this.#run = run
  }

  plug<T extends Files | undefined>(arg: Plug<T> | PlugFunction<T>): Pipe & Promise<T> {
    const plug = typeof arg === 'function' ? { pipe: arg } : arg
    const promise = this.#promise.then((files) => {
      assert(files, 'Pipe can not be further extended')
      return plug.pipe(files, this.#run)
    })
    return new PipeImpl(promise, this.#run)
  }

  then<T1 = T, T2 = never>(
      onfulfilled?: ((value: T) => T1 | PromiseLike<T1>) | null | undefined,
      onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null | undefined,
  ): Promise<T1 | T2> {
    return this.#promise.then(onfulfilled, onrejected)
  }

  catch<T0 = never>(
      onrejected?: ((reason: any) => T0 | PromiseLike<T0>) | null | undefined,
  ): Promise<T0 | T> {
    return this.#promise.catch(onrejected)
  }

  finally(
      onfinally?: (() => void) | null | undefined,
  ): Promise<T> {
    return this.#promise.finally(onfinally)
  }

  [Symbol.toStringTag] = 'Pipe'
}

/* ========================================================================== *
 * PLUG INSTALLATION (INTERNAL)                                               *
 * ========================================================================== */

/** The names which can be installed as direct plugs. */
export type PlugName = string & Exclude<keyof Pipe, 'plug' | keyof Promise<Files>>

/** A convenience type identifying a {@link Plug} constructor. */
export type PlugConstructor = new (...args: any) => Plug<Files | undefined>

/** Convert the resulting type of a {@link Plug} for use in a {@link Pipe} */
type PlugReturnForPipe<T> =
  T extends Plug<infer R> ?
    R extends Files ?
      Promise<Files> & Pipe :
    R extends undefined ?
      Promise<undefined> :
    never :
  never

/**
 * Map constructors into an array of all known overloads.
 *
 * This is a _royal_ pain in the ass, as we need to distinguish between
 * all possible number of overloads of a constructor... Limit to 5 of them!
 *
 * Also, the empty constructor (when specified in the overloads) will simply
 * match the first case (most overloads) and generate functions somewhat like
 *
 * (...args: unknown[]) => never
 * (...args: unknown[]) => never
 * (...args: unknown[]) => never
 * () => PlugReturnForPipe<R3>
 * (arg: Options) => PlugReturnForPipe<R4>
 *
 * Somehow inferring the result to `Function` or the right type and ANDing all
 * those together here doesn't work, so we create this array and we'll AND
 * all its members in the PipeExtension<...> type.
 */
type PlugConstructorOverloads<T extends PlugConstructor> =
  T extends {
    new (...args: infer A0): infer R0
    new (...args: infer A1): infer R1
    new (...args: infer A2): infer R2
    new (...args: infer A3): infer R3
    new (...args: infer A4): infer R4
  } ? [
    R0 extends Plug<Files | undefined> ? ((...args: A0) => PlugReturnForPipe<R0>) : Function,
    R1 extends Plug<Files | undefined> ? ((...args: A1) => PlugReturnForPipe<R1>) : Function,
    R2 extends Plug<Files | undefined> ? ((...args: A2) => PlugReturnForPipe<R2>) : Function,
    R3 extends Plug<Files | undefined> ? ((...args: A3) => PlugReturnForPipe<R3>) : Function,
    R4 extends Plug<Files | undefined> ? ((...args: A4) => PlugReturnForPipe<R4>) : Function,
  ] :
  T extends {
    new (...args: infer A0): infer R0
    new (...args: infer A1): infer R1
    new (...args: infer A2): infer R2
    new (...args: infer A3): infer R3
  } ? [
    R0 extends Plug<Files | undefined> ? (...args: A0) => PlugReturnForPipe<R0> : Function,
    R1 extends Plug<Files | undefined> ? (...args: A1) => PlugReturnForPipe<R1> : Function,
    R2 extends Plug<Files | undefined> ? (...args: A2) => PlugReturnForPipe<R2> : Function,
    R3 extends Plug<Files | undefined> ? (...args: A3) => PlugReturnForPipe<R3> : Function,
  ] :
  T extends {
    new (...args: infer A0): infer R0
    new (...args: infer A1): infer R1
    new (...args: infer A2): infer R2
  } ? [
    R0 extends Plug<Files | undefined> ? (...args: A0) => PlugReturnForPipe<R0> : Function,
    R1 extends Plug<Files | undefined> ? (...args: A1) => PlugReturnForPipe<R1> : Function,
    R2 extends Plug<Files | undefined> ? (...args: A2) => PlugReturnForPipe<R2> : Function,
  ] :
  T extends {
    new (...args: infer A0): infer R0
    new (...args: infer A1): infer R1
  } ? [
    R0 extends Plug<Files | undefined> ? (...args: A0) => PlugReturnForPipe<R0> : Function,
    R1 extends Plug<Files | undefined> ? (...args: A1) => PlugReturnForPipe<R1> : Function,
  ] :
  T extends {
    new (...args: infer A0): infer R0
  } ? [
    R0 extends Plug<Files | undefined> ? (...args: A0) => PlugReturnForPipe<R0> : Function,
  ] :
  never

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
 * install('write', Write)
 *
 * declare module '../pipe' {
 *   export interface Pipe {
 *     write: PipeExtension<typeof Write>
 *   }
 * }
 * ```
 */
export type PipeExtension<T extends PlugConstructor, A = PlugConstructorOverloads<T>> =
  A extends readonly [ infer First, ...infer Rest ] ?
    First & PipeExtension<T, Rest> :
  A extends readonly [ infer Only ] ?
    Only :
  Function

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
 * install('write', Write)
 *
 * declare module '../pipe' {
 *   export interface Pipe {
 *     write: PipeExtension<typeof Write>
 *   }
 * }
 * ```
 */
export function install<C extends PlugConstructor>(name: PlugName, ctor: C): void {
  /* This is quite hairy when it comes to types, so, just give up! :-P */

  function create(this: Pipe, ...args: any): Pipe & Promise<Files | undefined> {
    // eslint-disable-next-line new-cap
    return this.plug(new ctor(...args) as any)
  }

  /* Setup name so that stack traces look better */
  Object.defineProperty(create, 'name', { value: name })

  /* Inject the create function in the Pipe's prototype */
  Object.defineProperty(Pipe.prototype, name, { value: create })
}
