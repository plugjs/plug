/* eslint-disable no-var */

/// <reference no-default-lib="true"/>

/**
 * @deprecated Use our own `__fileurl` which resolves to either `__filename`
 *             in CJS modules or `import.meta.url` in ESM modules.
 */
declare var __filename: string

/**
 * A pseudo-variable replaced by `ESBuild` resolving to either `__filename`
 * in CJS modules, or to `import.meta.url` in ESM modules.
 */
declare var __fileurl: string
