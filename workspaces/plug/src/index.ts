import './globals.ts'

// This is a main constituent of our build system!
import type { Files } from './files.ts'
import type { Plug, PlugFunction } from './pipe.ts'

export { Files } from './files.ts'
export type { AbsolutePath } from './paths.ts'
export type { Plug, PlugFunction } from './pipe.ts'

/**
 * The {@link Pipe} interface defines a processing pipeline where multiple
 * {@link Plug}s can transform lists of {@link Files}.
 *
 * This is exported _here_, in the main module export file so that plugs can
 * add definitions by simply referring the module.
 */
export interface Pipe extends Promise<Files> {
  plug(plug: Plug<Files>): Pipe
  plug(plug: PlugFunction<Files>): Pipe
  plug(plug: Plug<void | undefined>): Promise<undefined>
  plug(plug: PlugFunction<void | undefined>): Promise<undefined>
  plug(plug: Plug<Files | void | undefined>): Pipe | Promise<undefined>
  plug(plug: PlugFunction<Files | void | undefined>): Pipe | Promise<undefined>
}

// Submodule exports (our package.json exports)
export * as asserts from './asserts.ts'
export * as async from './async.ts'
export * as files from './files.ts'
export * as fork from './fork.ts'
export * as fs from './fs.ts'
export * as logging from './logging.ts'
export * as paths from './paths.ts'
export * as pipe from './pipe.ts'
export * as utils from './utils.ts'

// Individual utilities
export { assert, BuildFailure, fail } from './asserts.ts'
export { $blu, $cyn, $grn, $gry, $mgt, $ms, $p, $red, $t, $und, $wht, $ylw, banner, log } from './logging.ts'

// Our minimal exports
export * from './build.ts'
export * from './helpers.ts'
export * from './plugs.ts'
export * from './types.ts'
