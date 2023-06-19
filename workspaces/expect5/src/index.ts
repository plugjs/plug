import { installForking } from '@plugjs/plug/fork'
import { requireResolve } from '@plugjs/plug/paths'

import type { ForkOptions } from '@plugjs/plug/fork'

/* ========================================================================== *
 * EXPORTED VARIABLES (for when globals is false)                             *
 * ========================================================================== */

export { skip } from './execution/executable'
export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  fdescribe,
  fit,
  it,
  xafterAll,
  xafterEach,
  xbeforeAll,
  xbeforeEach,
  xdescribe,
  xit,
} from './execution/setup'
export * from './expectation/expect'


/* ========================================================================== *
 * EXPORTED OPTIONS TYPE AND PLUG DEFINITION                                  *
 * ========================================================================== */

/** Options to construct our {@link Jasmine} plug. */
export interface TestOptions extends ForkOptions {
  /** Report up to the specified amount of failures (default: `+Infinity`) */
  maxFailures?: number,
  /**
   * Specify whether the variables (`describe`, `it`, `expect`, ...) will be
   * exposed as _global_ variables to tests or not (default: `true`)
   */
  globals?: boolean,
  /**
   * Print differences between expected and actual values from generic errors
   * (e.g. `AssertionError` or _Chai_ expectations) (default: `true`)
   */
  genericErrorDiffs?: boolean,
}

declare module '@plugjs/plug' {
  export interface Pipe {
    /**
     * Run tests.
     *
     * @param options Optional {@link TestOptions | options}.
     */
    test(options?: TestOptions): Promise<undefined>
  }
}

/* ========================================================================== *
 * INSTALL FORKING PLUG                                                       *
 * ========================================================================== */

installForking('test', requireResolve(__fileurl, './test'), 'Test')
