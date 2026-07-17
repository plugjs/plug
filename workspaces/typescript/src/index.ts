import { installForking } from '@plugjs/plug/fork'
import { requireResolve } from '@plugjs/plug/paths'

import type { BuildOptions, CompilerOptions } from 'typescript'

/** Remove the mapped `[option: string]: ...` from `CompilerOptions`. */
type RemoveIndexSignature<T> = {
  [ k in keyof T as
  string extends k ? never :
  number extends k ? never :
  symbol extends k ? never :
  k ]: T[k]
}

/** TypeScript Compiler options with some additional properties */
export interface ExtendedCompilerOptions extends RemoveIndexSignature<CompilerOptions> {
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

export interface TscBuildOptions extends RemoveIndexSignature<BuildOptions> {}
export interface TscCompilerOptions extends RemoveIndexSignature<CompilerOptions> {}

/* Exports for "tscBuild" and "tsc" */
export { tscBuild } from './tscbuild.ts'
export type { ExtendedTscBuildOptions } from './tscbuild.ts'
export { tsc } from './tsccompiler.ts'
export type { ExtendedTscCompilerOptions } from './tsccompiler.ts'

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
     *
     * This is equivalent to running `tsc --build` from the command line.
     */
    tscBuild(): Pipe

    /**
     * Run the {@link https://www.typescriptlang.org/ TypeScript Builder}
     * over the specified project `tsconfig.json` files.
     *
     * This is equivalent to running `tsc --build ...` from the command line.
     *
     * With regards to `options`, the defaults are:
     * - `verbose: true`
     * - `force: true`
     *
     * @param options {@link TscBuildOptions} to use for the build.
     */
    tscBuild(options: TscBuildOptions): Pipe

    /**
     * Run the {@link https://www.typescriptlang.org/ TypeScript Compiler}
     * over the specified project `tsconfig.json` files.
     *
     * This is equivalent to running `tsc --project ...` from the command line.
     */
    tscCompiler(): Pipe

    /**
     * Run the {@link https://www.typescriptlang.org/ TypeScript Compiler}
     * over the specified project `tsconfig.json` files.
     *
     * This is equivalent to running `tsc --project ...` from the command line.
     *
     * @param options {@link TscCompilerOptions} to use for the build.
     */
    tscCompiler(options: TscCompilerOptions): Pipe
  }
}

installForking('tsc', requireResolve(__fileurl, './typescript'), 'Tsc')
installForking('tscBuild', requireResolve(__fileurl, './tscbuild'), 'TscBuild')
installForking('tscCompiler', requireResolve(__fileurl, './tsccompiler'), 'TscCompiler')
