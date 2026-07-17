/**
 * A pseudo-variable replaced by `ESBuild` resolving to either `__filename`
 * in CJS modules, or to `import.meta.url` in ESM modules.
 *
 * @deprecated As we are moving to ESM-only, this will be removed in the future.
 *             Use `import.meta.url` or `import.meta.filename` instead.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const __fileurl: string
