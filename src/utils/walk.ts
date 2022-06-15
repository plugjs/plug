import * as fs from 'node:fs/promises'

import { join } from 'node:path'
import { match } from './match'
import { parseOptions } from './options'

import type { MatchOptions } from './match'
import type { ParseOptions } from './options'

// Convenience type for an async generator over `FilePath`s
type WalkGenerator = AsyncGenerator<string, void, void>

// A generator function walking a `DirectoryPath` and yelding `FilePath`
// results for each entry it finds up until the given `maxDepth`
async function* walker(
    root: string,
    relative: string,
    matchFile: (path: string) => boolean,
    igoreDir: (path: string) => boolean,
    onDir: (directory: string) => boolean | void,
    symlinks: boolean,
    maxdepth: number,
    depth: number,
): WalkGenerator {
  // Read the directory, including file types
  const dir = join(root, relative)
  if (onDir(dir) === false) return
  const dirents = await fs.readdir(dir, { withFileTypes: true })

  // For each entry we determine the full path
  for (const dirent of dirents) {
    const path = join(relative, dirent.name)

    // If the entry is a file and matches, yield it
    if (dirent.isFile() && matchFile(path)) yield path

    // If the entry is a directory within our depth, walk it recursively
    else if (dirent.isDirectory() && (!igoreDir(path)) && (depth < maxdepth)) {
      const children = walker(root, path, matchFile, igoreDir, onDir, symlinks, maxdepth, depth + 1)
      for await (const child of children) yield child

    // If this is a symlink and we're told to check them let's see what we have
    } else if (dirent.isSymbolicLink() && symlinks) {
      const stat = await fs.stat(join(root, path))

      // If the link is a file and matches, yield it
      if (stat.isFile() && matchFile(path)) yield path

      // If the link is a directory within our depth, walk it recursively
      else if (stat.isDirectory() && (!igoreDir(path)) && (depth < maxdepth)) {
        const children = walker(root, path, matchFile, igoreDir, onDir, symlinks, maxdepth, depth + 1)
        for await (const child of children) yield child
      }
    }
  }
}

/** Specific options for walking a directory */
export interface WalkOptions extends MatchOptions {
  /**
   * Whether symlinks should be followed or not.
   *
   * @default true
   */
  followSymlinks?: boolean,

  /**
   * The maximum depth (in directory levels) to recurse into.
   *
   * @default Infinity
   */
  maxDepth?: number,

  /**
   * Whether to allow walking any `node_modules` directory or not.
   *
   * @default false
   */
  allowNodeModules?: boolean,

  /**
   * A callback invoked on each individual directory being walked.
   *
   * If the callback returns `false` the directory and all of its children will
   * not be walked.
   *
   * @default undefined
   */
  onDirectory?: (directory: string) => boolean | void,
}

/**
 * Walk the specified directory, returning an asynchronous iterator over all
 * the `FilePath`s found matching the specified globs and matching options
 */
export function walk(directory: string, ...args: ParseOptions<WalkOptions>): WalkGenerator {
  const { globs, options: { followSymlinks, maxDepth, onDirectory, ...options } } =
      parseOptions(args, {
        onDirectory: () => {},
        allowNodeModules: false,
        followSymlinks: true,
        maxDepth: Infinity,
      })

  // Create a negative matches from the ignores not to walk certain directories
  const directoryGlobs =
      typeof options.ignore === 'string' ? [ options.ignore ] :
      Array.isArray(options.ignore) ? [ ...options.ignore ] : []

  // Make sure to also ignore node modules or dot directories if we have to
  if (! options.allowNodeModules) directoryGlobs.push('**/node_modules')
  if (! options.dot) directoryGlobs.push('**/.*')

  // Create our negative matcher to ignore directories
  const ignoreDir = directoryGlobs.length === 0 ? () => false :
    match(...directoryGlobs as [ string, ...string[] ], { ...options, ignore: [] })

  // Create our positive matcher to match files
  const matchFile = match(...globs, options)

  // Do the walk!
  return walker(directory, '', matchFile, ignoreDir, onDirectory, followSymlinks, maxDepth, 0)
}
