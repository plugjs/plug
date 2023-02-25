import { installForking } from '@plugjs/plug/fork'
import { requireResolve } from '@plugjs/plug/paths'

export interface TsdOptions {
  cwd?: string,
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
