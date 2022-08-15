export * from './plugs/copy'
export * from './plugs/coverage'
export * from './plugs/debug'
export * from './plugs/esbuild'
export * from './plugs/eslint'
export * from './plugs/exec'
export * from './plugs/filter'
export * from './plugs/tsc'

import { installForking } from './fork'
import { requireResolve } from './paths'

import type { MochaRunner } from './plugs/mocha/runner'

declare module './pipe' {
  export interface Pipe {
    mocha: PipeExtension<typeof MochaRunner>
  }
}

installForking('mocha', requireResolve(__fileurl, './plugs/mocha/runner'), 'MochaRunner')
