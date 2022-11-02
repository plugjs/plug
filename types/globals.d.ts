/// <reference no-default-lib="true"/>

/**
 * A pseudo-variable replaced by `ESBuild` resolving to either `__filename`
 * in CJS modules, or to `import.meta.url` in ESM modules.
 */
declare const __fileurl: string
