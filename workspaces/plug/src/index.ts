// Reference our extra "webassembly" type fix here. As we're using esbuild
// everywhere, we want our dependants to have this type known...
/// <reference path="../types/plugjs.d.ts" />

// This is a main constituent of our build system!
import type { Files } from './files'
import type { Plug, PlugFunction } from './pipe'

/**
 * The {@link Pipe} interface defines a processing pipeline where multiple
 * {@link Plug}s can transform lists of {@link Files}.
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
export * as files from './files'
export * as fork from './fork'
export * as fs from './fs'
export * as logging from './logging'
export * as paths from './paths'
export * as pipe from './pipe'
export * as utils from './utils'

// Individual utilities
export { log, $ms, $p, $t, $blu, $cyn, $grn, $gry, $mgt, $red, $und, $wht, $ylw } from './logging'
export { assert, fail, BuildFailure } from './asserts'

// Our minimal exports
export * from './build'
export * from './helpers'
export * from './plugs'
export * from './types'
