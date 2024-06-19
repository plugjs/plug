/*
 * Type definition for `WebAssembly`. This is normally provided to TypeScript
 * by `lib.dom.d.ts`, and is not defined by Node's own types.
 *
 * https://github.com/evanw/esbuild/issues/2388
 */
declare namespace WebAssembly {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Module {} // just define an empty interface...
}
