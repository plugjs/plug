// Reference our extra "webassembly" type fix here. As we're using esbuild
// everywhere, we want our dependants to have this type known...
/// <reference path="../types/webassembly.d.ts" />

// Submodule exports (our package.json exports)
export * as assert from './assert'
export * as files from './files'
export * as fork from './fork'
export * as paths from './paths'
export * as pipe from './pipe'
export * as utils from './utils'

// This is a main constituent of our build system!
export type { Pipe } from './pipe'
export { log } from './log'

// Our minimal exports
export * from './build'
export * from './failure'
export * from './helpers'
export * from './plugs'
export * from './types'
