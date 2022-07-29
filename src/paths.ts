import assert from 'assert'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { BuildContext } from './build'
import { Run } from './run'
import { stat } from './utils/asyncfs'

export type AbsolutePath = string & { __brand_absolute_path: never }


export class Resolver {
  private readonly _buildDir: AbsolutePath
  private readonly _baseDir: AbsolutePath

  constructor(run: Run, context: BuildContext) {
    this._buildDir = context.buildDir
    this._baseDir = run.baseDir
  }

  resolve(path?: string): AbsolutePath {
    if (! path) return this._buildDir

    if (path.startsWith('@')) {
      const relative = path.substring(1)
      assert (! isAbsolutePath(relative), `Path component of "${path}" is absolute`)
      return resolveAbsolutePath(this._baseDir, relative)
    }

    if (isAbsolutePath(path)) return path

    return resolveAbsolutePath(this._buildDir, path)
  }
}


export function resolveAbsolutePath(directory: AbsolutePath, path: string, ...paths: string[]): AbsolutePath {
  const resolved = resolve(directory, path, ...paths) as AbsolutePath
  assert(isAbsolute(resolved), `Path "${join(path, ...paths)}" resolved in "${directory}" is not absolute`)
  return resolved
}

export function resolveRelativeChildPath(directory: AbsolutePath, path: string, ...paths: string[]): string | undefined {
  assertAbsolutePath(directory)

  const abs = resolve(directory, path, ...paths)
  const rel = relative(directory, abs)
  return (isAbsolute(rel) || (rel === '..') || rel.startsWith(`..${sep}`)) ? undefined : rel
}

export function convertRelativeChildPath(directory: AbsolutePath, path: string, ...paths: string[]): string {
  const relative = resolveRelativeChildPath(directory, path, ...paths)
  assert(relative, `Path "${join(path, ...paths)}" not relative to "${directory}"`)
  return relative
}

export function isAbsolutePath(p: string): p is AbsolutePath {
  return isAbsolute(p)
}

export function assertAbsolutePath(p: string): asserts p is AbsolutePath {
  assert(isAbsolute(p), `Path "${p}" not absolute`)
}

export function getAbsoluteParent(path: AbsolutePath): AbsolutePath {
  assertAbsolutePath(path)
  return dirname(path) as AbsolutePath
}

export function isFile(path: AbsolutePath, ...paths: string[]): Promise<AbsolutePath | undefined> {
  const file = resolve(path, ...paths)
  assertAbsolutePath(file)
  return stat(file).then((s) => s.isFile() ? file : undefined, (error) => {
    if (error.code === 'ENOENT') return undefined
    throw error
  })
}

export function isDirectory(path: AbsolutePath, ...paths: string[]): Promise<AbsolutePath | undefined> {
  const dir = resolve(path, ...paths)
  assertAbsolutePath(dir)
  return stat(dir).then((s) => s.isDirectory() ? dir : undefined, (error) => {
    if (error.code === 'ENOENT') return undefined
    throw error
  })
}
