import { installForking } from '@plugjs/plug/fork'
import { requireResolve } from '@plugjs/plug/paths'

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

/* Exports for "tsc" / "tscBuild" */
export { tsc, tscBuild } from './tscbuild'
export type { TscOptions } from './tscbuild'
export interface TscBuildOptions extends BuildOptions {}

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
    tscBuild(options: TscBuildOptions): Pipe
  }
}

installForking('tsc', requireResolve(__fileurl, './typescript'), 'Tsc')
installForking('tscBuild', requireResolve(__fileurl, './tscbuild'), 'TscBuild')
