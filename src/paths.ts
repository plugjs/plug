import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

import { assert } from './assert'
import { stat } from './utils/asyncfs'

/** A _branded_ `string` representing an _absolute_ path name */
export type AbsolutePath = string & { __brand_absolute_path: never }

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
 * Resolves the specified path as an {@link AbsolutePath} and checks it is a
 * _file_, returning `undefined` if it is not.
 */
export function isFile(path: AbsolutePath, ...paths: string[]): Promise<AbsolutePath | undefined> {
  const file = resolveAbsolutePath(path, ...paths)
  return stat(file).then((s) => s.isFile() ? file : undefined, (error) => {
    if (error.code === 'ENOENT') return undefined
    throw error
  })
}

/**
 * Resolves the specified path as an {@link AbsolutePath} and checks it is a
 * _directory_, returning `undefined` if it is not.
 */
export function isDirectory(path: AbsolutePath, ...paths: string[]): Promise<AbsolutePath | undefined> {
  const dir = resolveAbsolutePath(path, ...paths)
  return stat(dir).then((s) => s.isDirectory() ? dir : undefined, (error) => {
    if (error.code === 'ENOENT') return undefined
    throw error
  })
}
