import { installForking } from '@plugjs/plug/fork'
import { requireResolve } from '@plugjs/plug/paths'

export interface ESLintOptions {
  /** ESLint's own _current working directory_, where config files are. */
  directory?: string
  /** Show sources in report? */
  showSources?: boolean
  /** Do not warn about ESLint deprecated rule? */
  ingoreDeprecatedRules?: boolean
}

declare module '@plugjs/plug' {
  export interface Pipe {
    /**
     * Run {@link https://eslint.org/ _ESlint_} over the input source files,
     * using the configuration from the local `.eslintrc.*` file.
     */
    eslint(): Promise<undefined>

    /**
     * Run {@link https://eslint.org/ _ESlint_} over the input source files..
     *
     * @param options {@link ESLintOptions | Options} to pass to _ESLint_
     */
    eslint(options: ESLintOptions): Promise<undefined>
  }
}

installForking('eslint', requireResolve(__fileurl, './eslint'), 'ESLint')
