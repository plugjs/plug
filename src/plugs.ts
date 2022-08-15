export * from './plugs/copy'
export * from './plugs/coverage'
export * from './plugs/debug'
export * from './plugs/esbuild'
export * from './plugs/exec'
export * from './plugs/filter'
export * from './plugs/tsc'

import { installForking } from './fork'
import { requireResolve } from './paths'

import type { Mocha } from './plugs/mocha/runner'
import type { ESLint } from './plugs/eslint/runner'

declare module './pipe' {
  export interface Pipe {
    eslint: PipeExtension<typeof ESLint>
    mocha: PipeExtension<typeof Mocha>
  }
}

installForking('eslint', requireResolve(__fileurl, './plugs/eslint/runner'), 'ESLint')
installForking('mocha', requireResolve(__fileurl, './plugs/mocha/runner'), 'Mocha')
