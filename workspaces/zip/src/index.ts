import { installForking } from '@plugjs/plug/fork'
import { requireResolve } from '@plugjs/plug/paths'

/** Options for zipping files */
export interface ZipOptions {
  /** Force the modified timestamp for all files in the _ZIP archive_ */
  mtime?: Date;
  /** Force the mode for all files in the _ZIP archive_ */
  mode?: number;
  /** Compress all files in the _ZIP archive_ (default: `true`) */
  compress?: boolean;
  /** Force the `ZIP-64` format for all files in the _ZIP archive_ (default: `false`) */
  forceZip64Format?: boolean;
}

declare module '@plugjs/plug' {
  export interface Pipe {
    /**
     * Archive all input {@link Files} into a _ZIP archive_.
     *
     * @param filename - The output _ZIP archive_ file name.
     */
    zip(filename: string): Pipe

    /**
     * Archive all input {@link Files} into a _ZIP archive_.
     *
     * @param filename - The output _ZIP archive_ file name.
     * @param options - Options for zipping the archive.
     */
    zip(filename: string, options: ZipOptions): Pipe
  }
}

installForking('zip', requireResolve(__fileurl, './zip'), 'Zip')
