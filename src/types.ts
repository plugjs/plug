/* ========================================================================== *
 * TYPES OVERRIDES / EXTENSIONS                                               *
 * ========================================================================== */

import { WalkOptions } from './utils/walk'

/**
 * The {@link FindOptions} interface defines the options available to
 * {@link TaskContext.find}.
 */
export interface FindOptions extends WalkOptions {
  /**
   * The directory where to start looking for files.
   *
   * @defaultValue The current {@link Run.directory}
   */
   directory?: string
}

/*
 * Type definition for `WebAssembly`. This is normally provided to TypeScript
 * by `lib.dom.d.ts`, and is not defined by Node's own types.
 *
 * https://github.com/evanw/esbuild/issues/2388
 */
declare namespace WebAssembly {
  interface Module {} // for esbuild types
}
