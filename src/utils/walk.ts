import fs from './asyncfs'

import { join } from 'node:path'
import { match } from './match'
import { parseOptions } from './options'

import type { MatchOptions } from './match'
import type { ParseOptions } from './options'

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

  /**
   * A callback invoked on each individual directory being walked.
   *
   * If the callback returns `false` the directory and all of its children will
   * not be walked.
   *
   * @defaultValue `() => true`
   */
  onDirectory?: (directory: string) => boolean,
}

/** The {@link AsyncGenerator} yielding results for our matches. */
export type WalkGenerator = AsyncGenerator<string, void, void>

/**
 * Walk the specified directory, returning an asynchronous iterator over all
 * the files found matching the specified globs and matching options.
 */
 export function walk(directory: string, ...args: ParseOptions<WalkOptions>):  WalkGenerator {
  const {
    params: globs,
    options: {
      followSymlinks,
      maxDepth,
      allowNodeModules,
      onDirectory,
      ...options
    },
  } = parseOptions(args, defaults)

  /* Prepare some negative globs from the ignore option */
  const negativeGlobs =
    typeof options.ignore === 'string' ?
      [ options.ignore ] :
    Array.isArray(options.ignore) ?
      [ ...options.ignore ] :
    []

  /* Make sure to also ignore node modules or dot directories if we have to */
  if (! allowNodeModules) negativeGlobs.push('**/node_modules')
  if (! options.dot) negativeGlobs.push('**/.*')

  /* Create our negative matcher */
  const negativeMatcher =
    negativeGlobs.length > 0 ?
      match(...negativeGlobs as [ string, ...string[] ], { ...options, ignore: [] }) :
      () => false

  /* Create our positive matcher to match our globs */
  const positiveMatcher = globs.length > 0 ?
      match(...globs as [ string, ...string[] ], options) :
      () => true

  /* Do the walk! */
  return walker({
    directory,
    relative: '',
    positiveMatcher,
    negativeMatcher,
    onDirectory,
    followSymlinks,
    maxDepth,
    depth: 0
  })
}

/* ========================================================================== *
 * DEFAULTS                                                                   *
 * ========================================================================== */

const defaults = {
  onDirectory: () => true,
  allowNodeModules: false,
  followSymlinks: true,
  maxDepth: Infinity,
}

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

interface WalkerArguments {
  directory: string,
  relative: string,
  positiveMatcher: (path: string) => boolean,
  negativeMatcher: (path: string) => boolean,
  onDirectory: (directory: string) => boolean | void,
  followSymlinks: boolean,
  maxDepth: number,
  depth: number,
}

/* Walk a directory and yield matching results until the given `maxDepth` */
async function* walker(args: WalkerArguments): WalkGenerator {
  const {
    directory,
    relative,
    positiveMatcher,
    negativeMatcher,
    onDirectory,
    followSymlinks,
    maxDepth,
    depth,
  } = args

  /* Read the directory, including file types */
  const dir = join(directory, relative)
  if (onDirectory(dir) === false) return
  const dirents = await fs.readdir(dir, { withFileTypes: true })

  /* For each entry we determine the full path */
  for (const dirent of dirents) {
    const path = join(relative, dirent.name)

    /* If the entry is a file and matches, yield it */
    if (dirent.isFile() && positiveMatcher(path)) yield path

    /* If the entry is a directory within our depth, walk it recursively */
    else if (dirent.isDirectory() && (!negativeMatcher(path)) && (depth < maxDepth)) {
      const children = walker({ ...args, relative: path, depth: depth + 1 })
      for await (const child of children) yield child

    /* If this is a symlink and we're told to check them let's see what we have */
    } else if (dirent.isSymbolicLink() && followSymlinks) {
      const stat = await fs.stat(join(directory, path))

      /* If the link is a file and matches, yield it */
      if (stat.isFile() && positiveMatcher(path)) yield path

      /* If the link is a directory within our depth, walk it recursively */
      else if (stat.isDirectory() && (!negativeMatcher(path)) && (depth < maxDepth)) {
        const children = walker({ ...args, relative: path, depth: depth + 1 })
        for await (const child of children) yield child
      }
    }
  }
}
