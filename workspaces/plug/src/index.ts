// Re-refence our global exports
/// <reference path="../types/globals.d.ts" />

// Reference our extra "webassembly" type fix here. As we're using esbuild
// everywhere, we want our dependants to have this type known...
/// <reference path="../types/fixes.d.ts" />

// This is a main constituent of our build system!
import type { Files } from './files'
import type { Plug, PlugFunction } from './pipe'

export { Files } from './files'
export type { AbsolutePath } from './paths'
export type { Plug, PlugFunction } from './pipe'

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
export * as asserts from './asserts'
export * as async from './async'
export * as files from './files'
export * as fork from './fork'
export * as fs from './fs'
export * as logging from './logging'
export * as paths from './paths'
export * as pipe from './pipe'
export * as utils from './utils'

// Individual utilities
export { BuildFailure, assert, fail } from './asserts'
export { $blu, $cyn, $grn, $gry, $mgt, $ms, $p, $red, $t, $und, $wht, $ylw, banner, log } from './logging'

// Our minimal exports
export * from './build'
export * from './helpers'
export * from './plugs'
export * from './types'
