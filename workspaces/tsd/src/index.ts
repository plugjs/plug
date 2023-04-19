import { installForking } from '@plugjs/plug/fork'
import { requireResolve } from '@plugjs/plug/paths'

/** Options for the {@link Tsd} plug */
export interface TsdOptions {
  /** Current working directory of the project to retrieve the diagnostics for */
  cwd?: string,
  /** Path to the type definition file you want to test */
  typingsFile?: string,
}

declare module '@plugjs/plug' {
  export interface Pipe {
    /**
     * Run all tests from incoming {@link Files} with `Tsd`.
     *
     * @param options Options to comfigure Tsd.
     */
    tsd(options?: TsdOptions): Pipe
  }
}

installForking('tsd', requireResolve(__fileurl, './tsd'), 'Tsd')
