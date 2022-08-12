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

/**
 * `ESBuild` will replace this pseudo-variable with `true` or `false` depending
 * on whether the module was compiled as CJS (`true`) or ESM (`false`).
 */
declare var __cjs: boolean

/**
 * `ESBuild` will replace this pseudo-variable with `true` or `false` depending
 * on whether the module was compiled as CJS (`false`) or ESM (`true`).
 */
declare var __esm: boolean
