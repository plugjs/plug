// Reference our extra "webassembly" type fix here. As we're using esbuild
// everywhere, we want our dependants to have this type known...
/// <reference path="../types/webassembly.d.ts" />

// Submodule exports (our package.json exports)
export * as assert from './asserts'
export * as files from './files'
export * as fork from './fork'
export * as fs from './fs'
export * as logging from './logging'
export * as paths from './paths'
export * as pipe from './pipe'
export * as utils from './utils'

// This is a main constituent of our build system!
export type { Pipe } from './pipe'
export { log } from './logging'

// Our minimal exports
export * from './build'
export * from './helpers'
export * from './plugs'
export * from './types'
