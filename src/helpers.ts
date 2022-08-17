import { assert } from './assert.js'
import { currentRun } from './async.js'
import { Files, FilesBuilder } from './files.js'
import { $p, log, LogLevelString } from './log.js'
import { AbsolutePath, commonPath, getCurrentWorkingDirectory, isDirectory } from './paths.js'
import { Pipe } from './pipe.js'
import { FindOptions } from './run.js'
import { rm } from './utils/asyncfs.js'
import { ParseOptions } from './utils/options.js'

/**
 * Recursively remove the specified directory _**(use with care)**_.
 */
export async function rmrf(directory: string): Promise<void> {
  const run = currentRun()
  assert(run, 'Unable to find files outside a running task')
  const dir = run.resolve(directory)

  assert(dir !== getCurrentWorkingDirectory(),
      `Cowardly refusing to wipe current working directory ${$p(dir)}`)

  assert(dir !== run.buildDir,
      `Cowardly refusing to wipe build file directory ${$p(dir)}`)

  if (! isDirectory(dir)) {
    log.info('Directory', $p(dir), 'not found')
    return
  }

  log.notice('Removing directory', $p(dir), 'recursively')
  await rm(dir, { recursive: true })
}

/**
 * Set the current _log level_.
 *
 * The _level_ will be applied _only_ within the execution of the current task.
 */
export function setLogLevel(level: LogLevelString): void {
  const run = currentRun()
  assert(run, 'Unable to find files outside a running task')
  return run.setLogLevel(level)
}

/**
 * Resolve a path into an {@link AbsolutePath}.
 *
 * If the path starts with `@...` it is considered to be relative to the
 * _directory containing the build file where the task was defined_, otherwise
 * it will be relative to the {@link process.cwd | current working directory}.
 */
export function resolve(...paths: string[]): AbsolutePath {
  const run = currentRun()
  assert(run, 'Unable to find files outside a running task')
  return run.resolve(...paths)
}


/**
 * Create a new {@link Files} instance.
 */
export function files(files: Files): FilesBuilder
export function files(directory: string, ...paths: string[]): FilesBuilder
export function files(first: Files | string | undefined, ...paths: string[]): FilesBuilder {
  const run = currentRun()
  assert(run, 'Unable to create files builder outside a running task')
  if (typeof first === 'string') {
    return run.files(first, ...paths)
  } else if (first) {
    return run.files(first)
  } else {
    return run.files()
  }
}

/**
 * Merge multiple {@link Files} instance.
 */
export function merge(args: (Files | Promise<Files>)[]): Promise<Files> & Pipe {
  const run = currentRun()
  assert(run, 'Unable to create files builder outside a running task')

  const promise = Promise.resolve().then(async () => {
    // No arguments, no files... Just convenience!
    if (args.length === 0) return run.pipe(run.files().build())

    // Resolve all the `Files` instances (might be from other tasks)
    const instances = await Promise.all(args)
    const [ first, ...others ] = instances

    const firstDir = first.directory
    const otherDirs = others.map((f) => f.directory)

    const directory = commonPath(firstDir, ...otherDirs)

    return run.files(directory).merge(first, ...others).build()
  })

  return run.pipe(promise)
}

/**
 * Find files according to the globs and {@link FindOptions} specified.
 */
export function find(glob: string, ...args: ParseOptions<FindOptions>): Pipe & Promise<Files> {
  const run = currentRun()
  assert(run, 'Unable to find files outside a running task')
  return run.find(glob, ...args)
}

/** Create a {@link Pipe} from a {@link Files} instance. */
export function pipe(files: Files | Promise<Files>): Pipe & Promise<Files> {
  const run = currentRun()
  assert(run, 'Unable to create pipes outside a running task')
  return run.pipe(files)
}
