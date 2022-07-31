import fs from './asyncfs'

import path, { join } from 'node:path'
import { match } from './match'

import type { MatchOptions } from './match'
import { $p, log } from '../log'
import { AbsolutePath, resolveAbsolutePath } from '../paths'

/** Specific options for walking a directory */
export interface WalkOptions extends MatchOptions {
  /**
   * Whether symlinks should be followed or not.
   *
   * @defaultValue `true`
   */
  followSymlinks?: boolean,

  /**
   * The maximum depth (in directory levels) to recurse into.
   *
   * @defaultValue `Infinity`
   */
  maxDepth?: number,

  /**
   * Whether to allow walking any `node_modules` directory or not.
   *
   * @defaultValue `false`
   */
  allowNodeModules?: boolean,
}

/**
 * Walk the specified directory, returning an asynchronous iterator over all
 * the _relative_ files found matching the specified globs and matching options.
 */
export function walk(
    directory: AbsolutePath,
    globs: string[],
    options: WalkOptions = {},
): AsyncGenerator<string, void, void> {
  const {
    maxDepth = Infinity,
    followSymlinks = true,
    allowNodeModules = false,
    ...opts
  } = options

  /* Make sure to also ignore node modules or dot directories if we have to */
  const onDirectory = (directory: AbsolutePath): boolean => {
    const name = path.basename(directory)
    if (name === 'node_modules') return !!allowNodeModules
    if (name.startsWith('.')) return !!opts.dot
    return true
  }

  /* Create our positive matcher to match our globs */
  const positiveMatcher = match(globs, opts)

  /* Do the walk! */
  log.debug('Walking directory', $p(directory), { globs, options })
  return walker({
    directory,
    relative: '',
    matcher: positiveMatcher,
    onDirectory,
    followSymlinks,
    maxDepth,
    depth: 0,
  })
}

/**
 * Walk the specified directory, returning an asynchronous iterator over all
 * the _relative_ files found matching the specified globs and matching options.
 */
export async function* absoluteWalk(
    directory: AbsolutePath,
    globs: string[],
    options: WalkOptions = {},
): AsyncGenerator<AbsolutePath, void, void> {
  for await (const relative of walk(directory, globs, options)) {
    yield resolveAbsolutePath(directory, relative)
  }
}

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

interface WalkerArguments {
  directory: AbsolutePath,
  relative: string,
  matcher: (path: string) => boolean,
  onDirectory: (directory: AbsolutePath) => boolean,
  followSymlinks: boolean,
  maxDepth: number,
  depth: number,
}

/* Walk a directory and yield matching results until the given `maxDepth` */
async function* walker(args: WalkerArguments): AsyncGenerator<string, void, void> {
  const {
    directory,
    relative,
    matcher: positiveMatcher,
    onDirectory,
    followSymlinks,
    maxDepth,
    depth,
  } = args

  /* Read the directory, including file types */
  const dir = resolveAbsolutePath(directory, relative)
  if (! onDirectory(dir)) return
  log.trace('Reading directory', $p(dir))
  const dirents = await fs.readdir(dir, { withFileTypes: true }).catch((error) => {
    if (error.code !== 'ENOENT') throw error
    log.warn('Directory', $p(dir), 'not found').sep()
    return []
  })

  /* For each entry we determine the full path */
  for (const dirent of dirents) {
    const path = join(relative, dirent.name)

    /* If the entry is a file and matches, yield it */
    if (dirent.isFile() && positiveMatcher(path)) yield path

    /* If the entry is a directory within our depth, walk it recursively */
    else if (dirent.isDirectory() && (depth < maxDepth)) {
      const children = walker({ ...args, relative: path, depth: depth + 1 })
      for await (const child of children) yield child

    /* If this is a symlink and we're told to check them let's see what we have */
    } else if (dirent.isSymbolicLink() && followSymlinks) {
      const stat = await fs.stat(join(directory, path))

      /* If the link is a file and matches, yield it */
      if (stat.isFile() && positiveMatcher(path)) yield path

      /* If the link is a directory within our depth, walk it recursively */
      else if (stat.isDirectory() && (depth < maxDepth)) {
        const children = walker({ ...args, relative: path, depth: depth + 1 })
        for await (const child of children) yield child
      }
    }
  }
}
