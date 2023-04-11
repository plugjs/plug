import { installForking } from '@plugjs/plug/fork'
import { requireResolve } from '@plugjs/plug/paths'

/* ========================================================================== *
 * EXPORTED VARIABLES (for when globals is false)                             *
 * ========================================================================== */

export {
  describe, fdescribe, xdescribe,
  it, fit, xit,
  afterAll, afterEach, xafterAll, xafterEach,
  beforeAll, beforeEach, xbeforeAll, xbeforeEach,
} from './execution/setup'
export { skip } from './execution/executable'
export { expect } from './expectation/expect'

/* ========================================================================== *
 * EXPORTED OPTIONS TYPE AND PLUG DEFINITION                                  *
 * ========================================================================== */

/** Options to construct our {@link Jasmine} plug. */
export interface TestOptions {
  /** Specify the directory where coverage data will be saved */
  coverageDir?: string,
  /**
   * Specify whether globals (`describe`, `it`, `expect`, ...) will be
   * exposed as _global_ variables to tests or not (default: `true`)
   */
  globals?: boolean,
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
