import { statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { assert } from './assert.js'

/** A _branded_ `string` representing an _absolute_ path name */
export type AbsolutePath = string & { __brand_absolute_path: never }

/* ========================================================================== *
 * PATH FUNCTIONS                                                             *
 * ========================================================================== */

/** Resolve a path into an {@link AbsolutePath} */
export function resolveAbsolutePath(directory: AbsolutePath, ...paths: string[]): AbsolutePath {
  const resolved = resolve(directory, ...paths) as AbsolutePath
  assert(isAbsolute(resolved), `Path "${join(...paths)}" resolved in "${directory}" is not absolute`)
  return resolved
}

/**
 * Resolve a path as a relative path to the directory specified, returning the
 * relative child path or `undefined` if the specified path was not a child.
 *
 * The `path` specified here _could_ also be another {@link AbsolutePath}
 * therefore something like this will work:
 *
 * ```
 * resolveRelativeChildPath('/foo', '/foo/bar')
 * // will yield `bar`
 * ```
 */
export function resolveRelativeChildPath(directory: AbsolutePath, ...paths: string[]): string | undefined {
  assertAbsolutePath(directory)

  const abs = resolveAbsolutePath(directory, ...paths)
  const rel = relative(directory, abs)
  return (isAbsolute(rel) || (rel === '..') || rel.startsWith(`..${sep}`)) ? undefined : rel
}

/**
 * Asserts that a path is a relative path to the directory specified, failing
 * the build if it's not (see also {@link resolveRelativeChildPath}).
 */

export function assertRelativeChildPath(directory: AbsolutePath, ...paths: string[]): string {
  const relative = resolveRelativeChildPath(directory, ...paths)
  assert(relative, `Path "${join(...paths)}" not relative to "${directory}"`)
  return relative
}

/** Checks that the specified path is an {@link AbsolutePath} */
export function isAbsolutePath(path: string): path is AbsolutePath {
  return isAbsolute(path)
}

/** Asserts that the specified path is an {@link AbsolutePath} */
export function assertAbsolutePath(p: string): asserts p is AbsolutePath {
  assert(isAbsolute(p), `Path "${p}" not absolute`)
}

/** Return the {@link AbsolutePath} parent of another */
export function getAbsoluteParent(path: AbsolutePath): AbsolutePath {
  assertAbsolutePath(path)
  return dirname(path) as AbsolutePath
}

/**
 * Return the {@link process.cwd() | current working directory} as an
 * {@link AbsolutePath}.
 */
export function getCurrentWorkingDirectory(): AbsolutePath {
  const cwd = process.cwd()
  assertAbsolutePath(cwd)
  return cwd
}


/* ========================================================================== *
 * MODULE RESOLUTION FUNCTIONS                                                *
 * ========================================================================== */

/**
 * Return the absolute path of a file relative to the given `__fileurl`, where
 * `__fileurl` is either CommonJS's own `__filename` variable, or EcmaScript's
 * `import.meta.url` (so either an absolute path name, or a `file:///...` url).
 *
 * If further `paths` are specified, those will be resolved as relative paths
 * to the original `__fileurl` so we can easily write something like this:
 *
 * ```
 * const dataFile = resolveFilename(__fileurl, 'data.json')
 * // if we write this in "/foo/bar/baz.(ts|js|cjs|mjs)"
 * // `dataFile` will now be "/foo/bar/data.json"
 * ```
 */
export function requireFilename(__fileurl: string, ...paths: string[]): AbsolutePath {
  /* Convert any "file:..." URL into a path name */
  const file = __fileurl.startsWith('file:') ? fileURLToPath(__fileurl) : __fileurl

  /* We should really have a proper absolute file name now */
  assertAbsolutePath(file)

  /* No paths? Return the file! */
  if (! paths.length) return file

  /* Resolve any paths, relative to the file */
  const directory = getAbsoluteParent(file)
  return resolveAbsolutePath(directory, ...paths)
}

/**
 * Return the absolute path of a file which can be _required_ or _imported_
 * by Node (or forked to via `child_process.fork`).
 *
 * This leverages {@link requireFilename} to figure out the starting point where
 * to look for files, and will _try_ to match the same extension of `__fileurl`
 * (so, `.ts` for `ts-node`, `.mjs` for ESM modules, ...).
 */
export function requireResolve(__fileurl: string, module: string): AbsolutePath {
  const file = requireFilename(__fileurl)

  // We do our custom resolution _only_ for local (./foo.bar) files...
  if (module.match(/^\.\.?\//)) {
    // If we import "../foo.ext" from "/a/b/c/bar.ts" we need to check:
    // * /a/b/foo.ext
    // * /a/b/foo.ext.ts
    // * /a/b/foo.ext/index.ts
    // ... then delegate to the standard "require.resolve(...)"
    const url = pathToFileURL(file)
    const ext = extname(file)
    const checks = ext ? [ `${module}`, `${module}${ext}`, `${module}/index${ext}` ] : [ module ]

    for (const check of checks) {
      const resolved = fileURLToPath(new URL(check, url)) as AbsolutePath
      if (resolveFile(resolved)) {
        module = check
        break
      }
    }
  }

  const require = createRequire(file)
  const required = require.resolve(module)
  assertAbsolutePath(required)
  return required
}

/**
 * Return the _common_ path amongst all specified paths.
 *
 * While the first `path` _must_ be an {@link AbsolutePath}, all other `paths`
 * can be _relative_ and will be resolved against the first `path`.
 */
export function commonPath(path: AbsolutePath, ...paths: string[]): AbsolutePath {
  assertAbsolutePath(path)

  // Here the first path will be split into its components
  // on win => [ 'C:', 'Windows', 'System32' ]
  // on unx => [ '', 'usr'
  const components = normalize(path).split(sep)

  let length = components.length
  for (const current of paths) {
    const absolute = resolveAbsolutePath(path, current)
    const parts = absolute.split(sep)
    for (let i = 0; i < length; i++) {
      if (components[i] !== parts[i]) {
        length = i
        break
      }
    }

    assert(length, 'No common ancestors amongst paths')
  }

  const common = components.slice(0, length).join(sep)
  assertAbsolutePath(common)
  return common
}

/* ========================================================================== *
 * FILE CHECKING FUNCTIONS                                                    *
 * ========================================================================== */

/**
 * Resolves the specified path as an {@link AbsolutePath} and checks it is a
 * _file_, returning `undefined` if it is not.
 */
export function resolveFile(path: AbsolutePath, ...paths: string[]): AbsolutePath | undefined {
  const file = resolveAbsolutePath(path, ...paths)
  try {
    const stat = statSync(file)
    if (stat.isFile()) return file
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error
  }
  return undefined
}

/**
 * Resolves the specified path as an {@link AbsolutePath} and checks it is a
 * _directory_, returning `undefined` if it is not.
 */
export function resolveDirectory(path: AbsolutePath, ...paths: string[]): AbsolutePath | undefined {
  const directory = resolveAbsolutePath(path, ...paths)
  try {
    const stat = statSync(directory)
    if (stat.isDirectory()) return directory
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error
  }
  return undefined
}
