import { requireResolve } from '../paths'
import { installForking } from '../pipe'

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
     * Run {@link https://eslint.org/ _ESlint_} over the input source files,
     * using the configuration from the local `.eslintrc.*` file.
     */
    eslint(): Promise<undefined>

    /**
     * Run {@link https://eslint.org/ _ESlint_} over the input source files,
     * using the configuration from the specified `configFile` (this wil
     * override any `.eslintrc.*` file).
     *
     * @param configFile The configuration file to use
     */
    eslint(configFile: string): Promise<undefined>

    /**
     * Run {@link https://eslint.org/ _ESlint_} over the input source files..
     *
     * @param options {@link ESLintOptions | Options} to pass to _ESLint_
     */
    eslint(options: ESLintOptions): Promise<undefined>
  }
}

installForking('eslint', requireResolve(__fileurl, './eslint/runner'))
