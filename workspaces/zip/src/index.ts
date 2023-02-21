import { installForking } from '@plugjs/plug/fork'
import { requireResolve } from '@plugjs/plug/paths'

declare module '@plugjs/plug' {
  export interface Pipe {
    /**
     * Archive all input {@link Files} into a _Zip_.
     *
     * @param filename The output zip file name.
     */
    zip(filename: string): Pipe
  }
}

installForking('zip', requireResolve(__fileurl, './zip'), 'Zip')
