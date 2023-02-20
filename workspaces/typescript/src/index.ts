import { installForking } from '@plugjs/plug/fork'
import { requireResolve } from '@plugjs/plug/paths'

import type { CompilerOptions } from 'typescript'

/** TypeScript Compiler options with some additional properties */
export interface ExtendedCompilerOptions extends CompilerOptions {
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
  }
}

installForking('tsc', requireResolve(__fileurl, './typescript'), 'Tsc')
