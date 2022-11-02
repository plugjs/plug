import { basename, join } from 'node:path'

import { $p, log } from '../log'
import { resolveAbsolutePath } from '../paths'
import { opendir, stat } from '../fs'
import { match } from './match'

import type { AbsolutePath } from '../paths'
import type { MatchOptions } from './match'
import type { Dir } from 'node:fs'

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
  const onDirectory = (dir: AbsolutePath): boolean => {
    // if we were told to start looking into "node_modules", or in a directory
    // starting with ".", then we ignore any whatsoever option here!
    if (dir === directory) return true
    const name = basename(dir)
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

  let dirents: Dir
  try {
    dirents = await opendir(dir)
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error
    log.warn('Directory', $p(dir), 'not found')
    return
  }

  /* For each entry we determine the full path */
  for await (const dirent of dirents) {
    const path = join(relative, dirent.name)

    /* If the entry is a file and matches, yield it */
    if (dirent.isFile() && positiveMatcher(path)) yield path

    /* If the entry is a directory within our depth, walk it recursively */
    else if (dirent.isDirectory() && (depth < maxDepth)) {
      const children = walker({ ...args, relative: path, depth: depth + 1 })
      for await (const child of children) yield child

    /* If this is a symlink and we're told to check them let's see what we have */
    } else if (dirent.isSymbolicLink() && followSymlinks) {
      const info = await stat(join(directory, path))

      /* If the link is a file and matches, yield it */
      if (info.isFile() && positiveMatcher(path)) yield path

      /* If the link is a directory within our depth, walk it recursively */
      else if (info.isDirectory() && (depth < maxDepth)) {
        const children = walker({ ...args, relative: path, depth: depth + 1 })
        for await (const child of children) yield child
      }
    }
  }
}
