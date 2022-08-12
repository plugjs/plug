import { join } from 'node:path'
import { assert } from './assert'
import { Files, FilesBuilder } from './files'
import { createReport, getLevelNumber, getLogger, Logger, LogLevelString, Report } from './log'
import { AbsolutePath, getCurrentWorkingDirectory, isAbsolutePath, resolveAbsolutePath } from './paths'
import { Pipe, PipeImpl } from './pipe'
import { ParseOptions, parseOptions } from './utils/options'
import { walk, WalkOptions } from './utils/walk'

/** The {@link FindOptions} interface defines the options for finding files. */
export interface FindOptions extends WalkOptions {
  /**
   * The directory where to start looking for files according to the rules
   * specified in {@link Run.resolve}.
   */
  directory?: string
}

/**
 * The {@link Run} interface defines the context in which a {@link Task} is
 * invoked.
 *
 * Runs keep track of the invocation stack (to avoid circular dependencies) and
 * of the cached results for {@link Task} invocations.
 */
export interface Run {
  /**
   * The _name_ of the task associated with this {@link Run} (if one is).
   *
   * Tasks can have different names in different builds, this refers to the
   * _task name_ in the build being executed.
   */
  readonly taskName: string
  /** The absolute file name of the build */
  readonly buildFile: AbsolutePath,
  /** For convenience, the directory of the build file */
  readonly buildDir: AbsolutePath,
  /** The {@link Logger} associated with this instance. */
  readonly log: Logger

  /** Set the logging level within this {@link Run} */
  setLogLevel(level: LogLevelString): void

  /** Call another {@link Task} from this one. */
  call(name: string): Promise<Files | undefined>

  /** Create a new {@link Report} with the given _title_ */
  report(title: string): Report

  /**
   * Resolve a path in the context of this {@link Run}.
   *
   * If the path starts with `@...` it is considered to be relative to the
   * {@link process.cwd | current working directory}, otherwise it will be
   * resolved against the build file where the task was originally defined in.
   */
  resolve(...paths: string[]): AbsolutePath

  /** Create a {@link FilesBuilder} cloning an existing {@link Files}. */
  files(files: Files): FilesBuilder

  /**
   * Create a {@link FilesBuilder} instance resolving the directory specified
   * according to the rules specified in {@link Run.resolve}.
   */
  files(...paths: string[]): FilesBuilder

  /**
   * Find files according to the globs and {@link FindOptions} specified.
   */
  find(glob: string, ...args: ParseOptions<FindOptions>): Pipe & Promise<Files>

  /**
   * Create a new {@link Pipe} wrapping the specified {@link Files}.
   */
  pipe(files: Files | Promise<Files>): Pipe & Promise<Files>
}

/** Constructor options for our default {@link Run} implementation */
export interface RunConstructionOptions {
  readonly taskName: string,
  readonly buildDir: AbsolutePath,
  readonly buildFile: AbsolutePath,
  readonly log?: Logger,
}

/** Our default {@link Run} implementation */
export class RunImpl implements Run {
  readonly taskName: string
  readonly buildFile: AbsolutePath
  readonly buildDir: AbsolutePath
  readonly log: Logger

  constructor(options: RunConstructionOptions)

  constructor({ taskName, buildDir, buildFile, log }: RunConstructionOptions) {
    this.taskName = taskName
    this.buildDir = buildDir
    this.buildFile = buildFile
    this.log = log || getLogger(taskName)
  }

  /** Set the logging level within this {@link Run} */
  setLogLevel(level: LogLevelString): void {
    this.log.level = getLevelNumber(level)
  }

  report(title: string): Report {
    return createReport(title, this.taskName)
  }

  resolve(...paths: string[]): AbsolutePath {
    const path = join(...paths)
    if (! path) return this.buildDir

    if (path.startsWith('@')) {
      const relative = path.substring(1)
      assert(! isAbsolutePath(relative), `Path component of "${path}" is absolute`)
      return resolveAbsolutePath(getCurrentWorkingDirectory(), relative)
    }

    if (isAbsolutePath(path)) return path

    return resolveAbsolutePath(this.buildDir, path)
  }

  files(files: Files): FilesBuilder
  files(...paths: string[]): FilesBuilder
  files(first: Files | string | undefined, ...paths: string[]): FilesBuilder {
    if (typeof first === 'string') {
      return Files.builder(this.resolve(first, ...paths))
    } else if (first) {
      return Files.builder(first)
    } else {
      return Files.builder(this.resolve())
    }
  }

  find(glob: string, ...args: ParseOptions<FindOptions>): Pipe & Promise<Files> {
    const { params, options: { directory, ...options } } = parseOptions(args, {})

    const promise = Promise.resolve().then(async () => {
      const builder = this.files(directory || '.')
      for await (const file of walk(builder.directory, [ glob, ...params ], options)) {
        builder.add(file)
      }
      return builder.build()
    })

    return this.pipe(promise)
  }

  pipe(files: Files | Promise<Files>): Pipe & Promise<Files> {
    return new PipeImpl(files, this)
  }

  call(name: string): Promise<Files | undefined> {
    throw new Error(`Unable to call task "${name}"`)
  }
}
