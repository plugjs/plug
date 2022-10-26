import type { CompilerOptions } from 'typescript'

import { requireResolve } from '../paths'
import { installForking } from '../fork'

declare module '../pipe' {
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
     * @param options {@link CompilerOptions | Options} overriding what's
     *                currently specified in the default `tsconfig.json`.
     */
    tsc(options: CompilerOptions): Pipe

    /**
     * Run the {@link https://www.typescriptlang.org/ TypeScript Compiler}
     * over the input source files, specifying the `tsconfig.json` file
     * and overriding some options
     *
     * @param configFile The `tsconfig.json` file to use.
     * @param options {@link CompilerOptions | Options} overriding what's
     *                currently specified in the specified `tsconfig.json`.
     */
    tsc(configFile: string, options: CompilerOptions): Pipe
  }
}

installForking('tsc', requireResolve(__fileurl, './tsc/runner'))
