import { requireResolve } from '../paths'
import { installForking } from '../pipe'
import { Runnable } from '../types'

export interface ESLintOptions {
  /** ESLint's own _current working directory_, where config files are. */
  directory?: string
  /** Show sources in report? */
  showSources?: boolean
  /**
   * ESLint's _override_ configuration file: configurations specified in this
   * file will override any other configuration specified elsewhere.
   */
  configFile?: string
}

declare module '../pipe' {
  export interface Pipe {
    /**
     * Run _ESLint_ over the input source files, using the configuration
     * from the local `.eslintrc.*` file.
     */
    eslint(): Runnable<undefined>

    /**
     * Run _ESLint_ over the input source files, using the configuration from
     * the specified `configFile` (this wil override any `.eslintrc.*` file).
     *
     * @param configFile The configuration file to use
     */
    eslint(configFile: string): Runnable<undefined>

    /**
     * Run _ESLint_ over the input source files.
     *
     * @param options {@link ESLintOptions | Options} to pass to _ESLint_
     */
    eslint(options: ESLintOptions): Runnable<undefined>
  }
}

installForking('eslint', requireResolve(__fileurl, './eslint/runner'))
