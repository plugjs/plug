import type { Files } from './files'
import type { Plug, PlugFunction, Result, Runnable } from './types'

import { ForkingPlug } from './fork'
import { AbsolutePath } from './paths'

/**
 * A class that will be extended by {@link Pipe} where {@link install} will
 * add prototype properties from installed {@link Plug}s
 */
abstract class PipeProto {
  abstract plug(plug: Plug<Result> | PlugFunction<Result>): Runnable<Result>
}

/**
 * The {@link Pipe} abstract defines processing pipeline where multiple
 * {@link Plug}s can transform lists of {@link Files}.
 */
export abstract class Pipe extends PipeProto {
  abstract plug(plug: Plug<Files>): Pipe
  abstract plug(plug: PlugFunction<Files>): Pipe
  abstract plug(plug: Plug<undefined>): Runnable<undefined>
  abstract plug(plug: PlugFunction<Files>): Runnable<undefined>

  abstract run(): Promise<Files>
}

/* ========================================================================== *
 * PLUG INSTALLATION (NEW)                                                    *
 * ========================================================================== */

/** The names which can be installed as direct plugs. */
export type PlugName = string & Exclude<keyof Pipe, 'plug' | 'run'>

/** The parameters of the plug extension with the given name */
export type PipeParameters<Name extends PlugName> =
  Pipe[Name] extends {
    (...args: infer A0): infer R0
    (...args: infer A1): infer R1
    (...args: infer A2): infer R2
    (...args: infer A3): infer R3
    (...args: infer A4): infer R4
  } ?
    | (R0 extends Runnable ? A0 : never)
    | (R1 extends Runnable ? A1 : never)
    | (R2 extends Runnable ? A2 : never)
    | (R3 extends Runnable ? A3 : never)
    | (R4 extends Runnable ? A4 : never)
  :
  Pipe[Name] extends {
    (...args: infer A0): infer R0
    (...args: infer A1): infer R1
    (...args: infer A2): infer R2
    (...args: infer A3): infer R3
  } ?
    | (R0 extends Runnable ? A0 : never)
    | (R1 extends Runnable ? A1 : never)
    | (R2 extends Runnable ? A2 : never)
    | (R3 extends Runnable ? A3 : never)
  :
  Pipe[Name] extends {
    (...args: infer A0): infer R0
    (...args: infer A1): infer R1
    (...args: infer A2): infer R2
  } ?
    | (R0 extends Runnable ? A0 : never)
    | (R1 extends Runnable ? A1 : never)
    | (R2 extends Runnable ? A2 : never)
  :
  Pipe[Name] extends {
    (...args: infer A0): infer R0
    (...args: infer A1): infer R1
  } ?
    | (R0 extends Runnable ? A0 : never)
    | (R1 extends Runnable ? A1 : never)
  :
  Pipe[Name] extends {
    (...args: infer A0): infer R0
  } ?
    | (R0 extends Runnable ? A0 : never)
  : never

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
 *   // ... the plug implementation lives here
 * })
 * ```
 */
export function install<
  Name extends PlugName,
  Ctor extends new (...args: PipeParameters<Name>) => Plug<Result>
>(name: Name, ctor: Ctor): void {
  /* The function plugging the newly constructed plug in a pipe */
  function plug(this: PipeProto, ...args: PipeParameters<Name>): Runnable<Result> {
    // eslint-disable-next-line new-cap
    return this.plug(new ctor(...args))
  }

  /* Setup name so that stack traces look better */
  Object.defineProperty(plug, 'name', { value: name })

  /* Inject the create function in the Pipe's prototype */
  Object.defineProperty(PipeProto.prototype, name, { value: plug })
}

/* ========================================================================== *
 * PLUG INSTALLATION (INTERNAL)                                               *
 * ========================================================================== */

/** A convenience type identifying a {@link Plug} constructor. */
export type PlugConstructor = new (...args: any) => Plug<Files | undefined>

/** Convert the resulting type of a {@link Plug} for use in a {@link Pipe} */
type PlugReturnForPipe<T> =
  T extends Plug<infer R> ?
    R extends Files ? Pipe :
    R extends undefined ? Runnable<undefined> :
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
export function installForking(
    plugName: PlugName,
    scriptFile: AbsolutePath,
): void {
  /** Extend out our ForkingPlug below */
  const ctor = class extends ForkingPlug {
    constructor(...args: any[]) {
      super(scriptFile, args)
    }
  }

  /** Install the plug in  */
  install(plugName, ctor)
}
