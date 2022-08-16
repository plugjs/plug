/* ========================================================================== *
 * FORKING PLUGS                                                              *
 * ========================================================================== */

import { installForking } from './fork.js'
import { requireResolve } from './paths.js'

import type { ESLint } from './plugs/eslint/runner.js'
import type { Mocha } from './plugs/mocha/runner.js'
import type { Tsc } from './plugs/tsc/runner.js'

declare module './pipe.js' {
  export interface Pipe {
    eslint: PipeExtension<typeof ESLint>
    mocha: PipeExtension<typeof Mocha>
    tsc: PipeExtension<typeof Tsc>
  }
}

installForking('eslint', requireResolve(__fileurl, './plugs/eslint/runner'), 'ESLint')
installForking('mocha', requireResolve(__fileurl, './plugs/mocha/runner'), 'Mocha')
installForking('tsc', requireResolve(__fileurl, './plugs/tsc/runner'), 'Tsc')

/* ========================================================================== *
 * STANDARD IN-PROCESS PLUGS                                                  *
 * ========================================================================== */

export * from './plugs/copy.js'
export * from './plugs/coverage.js'
export * from './plugs/debug.js'
export * from './plugs/esbuild.js'
export * from './plugs/exec.js'
export * from './plugs/filter.js'
