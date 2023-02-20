/// <reference no-default-lib="true"/>

/**
 * A pseudo-variable replaced by `ESBuild` resolving to either `__filename`
 * in CJS modules, or to `import.meta.url` in ESM modules.
 */
declare const __fileurl: string

/*
 * Type definition for `WebAssembly`. This is normally provided to TypeScript
 * by `lib.dom.d.ts`, and is not defined by Node's own types.
 *
 * https://github.com/evanw/esbuild/issues/2388
 */
declare namespace WebAssembly {
  interface Module {} // just define an empty interface...
}
