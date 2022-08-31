/* ========================================================================== *
 * FORKING PLUGS                                                              *
 * ========================================================================== */

import { requireResolve } from './paths'
import { installForking } from './pipe'

import type Mocha from './plugs/mocha/runner'
import type Tsc from './plugs/tsc/runner'

declare module './pipe' {
  export interface Pipe {
    mocha: PipeExtension<typeof Mocha>
    tsc: PipeExtension<typeof Tsc>
  }
}

installForking('mocha', requireResolve(__fileurl, './plugs/mocha/runner'))
installForking('tsc', requireResolve(__fileurl, './plugs/tsc/runner'))

/* ========================================================================== *
 * STANDARD IN-PROCESS PLUGS                                                  *
 * ========================================================================== */

export * from './plugs/eslint'

export * from './plugs/copy'
export * from './plugs/coverage'
export * from './plugs/debug'
export * from './plugs/esbuild'
export * from './plugs/exec'
export * from './plugs/filter'
export * from './plugs/rmf'
