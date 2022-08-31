import type { Files } from './files'
import type { AbsolutePath } from './paths'
import type { Plug, PlugFunction, Result } from './types'

import { ForkingPlug } from './fork'

/**
 * A class that will be extended by {@link Pipe} where {@link install} will
 * add prototype properties from installed {@link Plug}s
 */
abstract class PipeProto {
  abstract plug(plug: Plug<Result | void> | PlugFunction<Result | void>): Pipe | Call
}

/**
 * The {@link Pipe} abstract defines processing pipeline where multiple
 * {@link Plug}s can transform lists of {@link Files}.
 */
export abstract class Pipe extends PipeProto {
  abstract plug(plug: Plug<Files>): Pipe
  abstract plug(plug: PlugFunction<Files>): Pipe
  abstract plug(plug: Plug<void | undefined>): Call
  abstract plug(plug: PlugFunction<void | undefined>): Call

  abstract run(): Promise<Files>
}

export interface Call {
  run(): Promise<undefined>
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
    | (R0 extends (Pipe | Call) ? A0 : never)
    | (R1 extends (Pipe | Call) ? A1 : never)
    | (R2 extends (Pipe | Call) ? A2 : never)
    | (R3 extends (Pipe | Call) ? A3 : never)
    | (R4 extends (Pipe | Call) ? A4 : never)
  :
  Pipe[Name] extends {
    (...args: infer A0): infer R0
    (...args: infer A1): infer R1
    (...args: infer A2): infer R2
    (...args: infer A3): infer R3
  } ?
    | (R0 extends (Pipe | Call) ? A0 : never)
    | (R1 extends (Pipe | Call) ? A1 : never)
    | (R2 extends (Pipe | Call) ? A2 : never)
    | (R3 extends (Pipe | Call) ? A3 : never)
  :
  Pipe[Name] extends {
    (...args: infer A0): infer R0
    (...args: infer A1): infer R1
    (...args: infer A2): infer R2
  } ?
    | (R0 extends (Pipe | Call) ? A0 : never)
    | (R1 extends (Pipe | Call) ? A1 : never)
    | (R2 extends (Pipe | Call) ? A2 : never)
  :
  Pipe[Name] extends {
    (...args: infer A0): infer R0
    (...args: infer A1): infer R1
  } ?
    | (R0 extends (Pipe | Call) ? A0 : never)
    | (R1 extends (Pipe | Call) ? A1 : never)
  :
  Pipe[Name] extends {
    (...args: infer A0): infer R0
  } ?
    | (R0 extends (Pipe | Call) ? A0 : never)
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
  Ctor extends new (...args: PipeParameters<Name>) => Plug
>(name: Name, ctor: Ctor): void {
  /* The function plugging the newly constructed plug in a pipe */
  function plug(this: PipeProto, ...args: PipeParameters<Name>): Pipe | Call {
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
