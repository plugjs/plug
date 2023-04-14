import { installForking } from '@plugjs/plug/fork'
import { requireResolve } from '@plugjs/plug/paths'

/** Options to construct our {@link Jasmine} plug. */
export interface JasmineOptions {
  /** Specify the directory where coverage data will be saved */
  coverageDir?: string,

  /** Show differences for unmatched expectations (defaults to `true`). */
  showDiff?: boolean | undefined,

  /** Show stack trace for failed expectations (defaults to `true`). */
  showStack?: boolean | undefined,

  /**
   * Whether to randomize spec execution order or not (defaults to `false`).
   */
  random?: boolean | undefined,

  /**
   * Whether to stop execution of the suite after the first spec failure or not
   * (defaults to `false`).
   */
  stopOnSpecFailure?: boolean | undefined,

  /**
   * Whether to fail the spec if it ran no expectations.
   *
   * By default a spec that ran no expectations is reported as passed. Setting
   * this to true will report such spec as a failure.
   */
  failSpecWithNoExpectations?: boolean | undefined,

  /**
   * Whether to cause specs to only have one expectation failure or allow
   * multiple (defaults to `false`).
   */
  stopSpecOnExpectationFailure?: boolean | undefined,

  /**
   * Setup script to load before running the Jasmine specs.
   */
  setup?: string | undefined
}

declare module '@plugjs/plug' {
  export interface Pipe {
    /**
     * Run tests using {@link https://jasmine.github.io/ _Jasmine_}.
     *
     * @param options Optional {@link JasmineOptions | options} for _Jasmine_.
     */
    jasmine(options?: JasmineOptions): Promise<undefined>
  }
}

installForking('jasmine', requireResolve(__fileurl, './jasmine'), 'Jasmine')
