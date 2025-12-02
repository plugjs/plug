import { find } from '@plugjs/plug'
import { installForking } from '@plugjs/plug/fork'
import { requireResolve } from '@plugjs/plug/paths'

import type { Pipe } from '@plugjs/plug'
import type { BuildOptions, CompilerOptions } from 'typescript'

/** Remove the mapped `[option: string]: ...` from `CompilerOptions`. */
type KnownCompilerOptions = {
  [ k in keyof CompilerOptions as string extends k ? never : k ]: CompilerOptions[k]
}

/** TypeScript Compiler options with some additional properties */
export interface ExtendedCompilerOptions extends KnownCompilerOptions {
  /**
   * An additional directory containing a set of `.d.ts` files which will
   * be part of the compilation input, but not of the output.
   *
   * This can be useful when requiring (or fixing) specific types while
   * compiling a project, but the definition of those types does not affect
   * the resulting files (e.g. used only internally).
   */
  extraTypesDir?: string | undefined
}

declare module '@plugjs/plug' {
  export interface Pipe {
    /**
     * Run the {@link https://www.typescriptlang.org/ TypeScript Compiler}
     * over the input source files, using the default `tsconfig.json` file.
     */
    tsc(): Pipe

    /**
     * Run the {@link https://www.typescriptlang.org/ TypeScript Compiler}
     * over the input source files, specifying the `tsconfig.json` file.
     *
     * @param configFile The `tsconfig.json` file to use.
     */
    tsc(configFile: string): Pipe

    /**
     * Run the {@link https://www.typescriptlang.org/ TypeScript Compiler}
     * over the input source files, using the default `tsconfig.json` file
     * and overriding some options
     *
     * @param options {@link ExtendedCompilerOptions | Options} overriding
     *                the contents of the default `tsconfig.json`.
     */
    tsc(options: ExtendedCompilerOptions): Pipe

    /**
     * Run the {@link https://www.typescriptlang.org/ TypeScript Compiler}
     * over the input source files, specifying the `tsconfig.json` file
     * and overriding some options
     *
     * @param configFile The `tsconfig.json` file to use.
     * @param options {@link ExtendedCompilerOptions | Options} overriding
     *                the contents of the specified `tsconfig.json`.
     */
    tsc(configFile: string, options: ExtendedCompilerOptions): Pipe

    /**
     * Run the {@link https://www.typescriptlang.org/ TypeScript Builder}
     * over the specified project `tsconfig.json` files.
     */
    tscBuild(): Pipe

    /**
     * Run the {@link https://www.typescriptlang.org/ TypeScript Builder}
     * over the specified project `tsconfig.json` files.
     *
     * With regards to `options`, the defaults are:
     * - `verbose: true`
     * - `force: true`
     *
     * @param options {@link BuildOptions} to use for the build.
     */
    tscBuild(options: BuildOptions): Pipe
  }
}

installForking('tsc', requireResolve(__fileurl, './typescript'), 'Tsc')
installForking('tscBuild', requireResolve(__fileurl, './tscbuild'), 'TscBuild')

export interface TscBuildOptions extends BuildOptions {
  /** The directory where to look for the `tsconfig.json` files. */
  directory?: string
}

/**
 * Run `tsc --build` using `tsconfig.json` from the current directory.
 */
export function tscBuild(): Pipe
/**
 * Run `tsc --build` using the specified `tsconfig.json` file.
 */
export function tscBuild(tsconfig: string): Pipe
/**
 * Run `tsc --build` using the specified options.
 *
 * The `directory` option specifies where to look for the `tsconfig.json` files,
 * and defaults to the current directory, `verbose` and `force` default to
 * `true`.
 */
export function tscBuild(options: TscBuildOptions): Pipe
/**
 * Run `tsc --build` using the specified `tsconfig.json` and options.
 *
 * The `directory` option specifies where to look for the `tsconfig.json` files,
 * and defaults to the current directory, `verbose` and `force` default to
 * `true`.
 */
export function tscBuild(tsconfig: string, options?: TscBuildOptions): Pipe

// Implementation overload
export function tscBuild(
    tsconfigOrOptions?: string | TscBuildOptions,
    maybeOptions?: TscBuildOptions,
): Pipe {
  const [ tsconfig, tscBuildOptions ] =
    typeof tsconfigOrOptions === 'string'
      ? [ tsconfigOrOptions, maybeOptions ]
      : [ 'tsconfig.json', tsconfigOrOptions ]

  const { directory, ...buildOptions } = tscBuildOptions || {}
  return find(tsconfig, { directory }).tscBuild(buildOptions)
}
