import { installForking } from '../fork'
import { requireResolve } from '../paths'

/** Options to construct our {@link Mocha} plug. */
export interface MochaOptions {
  /** Specify the directory where coverage data will be saved */
  coverageDir?: string,
  /** Bail after first test failure? */
  bail?: boolean,
  /** Show diff on failure? */
  diff?: boolean,
  /** Report tests without running them? */
  dryRun?: boolean,
  /** Tests marked `only` fail the suite? */
  forbidOnly?: boolean,
  /** Pending tests fail the suite? */
  forbidPending?: false,
  /** Reporter name. */
  reporter?: string
  /** Options for the reporter */
  reporterOptions?: Record<string, any>,
  /** Number of times to retry failed tests. */
  retries?: number,
  /** Slow threshold value. */
  slow?: number,
  /** Setup file to import before running Mocha. */
  require?: string,
  /** Timeout threshold value. */
  timeout?: number,
}

declare module '../pipe' {
  export interface Pipe {
    /**
     * Run tests using {@link https://mochajs.org/ _Mocha_}.
     *
     * @param options Optional {@link MochaOptions | options} for _Mocha_.
     */
    mocha(options?: MochaOptions): Promise<undefined>
  }
}

installForking('mocha', requireResolve(__fileurl, './mocha/runner'), 'Mocha')
