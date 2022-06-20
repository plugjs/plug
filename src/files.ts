import assert from 'node:assert'
import path from 'node:path'
import util from 'node:util'

import type { Run } from './run'

/** The {@link FilesBuilder} interface defines a builder for {@link Files}. */
export interface FilesBuilder {
  /** The (resolved) directory the {@link Files} will be associated with */
  readonly directory: string
  /** Push files into the {@link Files} instance being built */
  push(...files: string[]): this
  /** Merge orther {@link Files} instance to the {@link Files} being built */
  merge(...files: Files[]): this
  /** Build and return a {@link Files} instance */
  build(): Files
}

/**
 * The {@link Files} class represents a collection of relative path names
 * identifying some _files_ rooted in a given _directory_.
 */
export class Files {
  readonly #directory: string
  readonly #files: string[]

  /**
   * Create a new {@link Files} instance rooted in the specified `directory`
   * relative to the specified {@link Run}'s directory.
   */
  constructor(run: Run, directory?: string) {
    this.#directory = directory ? path.resolve(run.directory, directory) : run.directory
    this.#files = []
  }

  /** Return the _directory_ where this {@link Files} is rooted */
  get directory(): string {
    return this.#directory
  }

  /** Return an iterator over all _relative_ files of this instance */
  *[Symbol.iterator](): Generator<string> {
    for (const file of this.#files) yield file
  }

  /** Return an iterator over all _absolute_ files of this instance */
  *absolutePaths(): Generator<string> {
    for (const file of this) yield path.resolve(this.#directory, file)
  }

  /** Return an iterator over all _relative_ to _absolute_ mappings */
  *pathMappings(): Generator<[ relative: string, absolute: string ]> {
    for (const file of this) yield [ file, path.resolve(this.#directory, file) ]
  }

  [util.inspect.custom]() {
    const self = this
    return new class Files {
      directory = self.#directory
      files = [ ...self.#files ]
    }
  }

  static builder(run: Run, directory?: string): FilesBuilder {
    const instance = new Files(run, directory)
    const set = new Set<string>()

    return {
      directory: instance.directory,

      push(...files: string[]): FilesBuilder {
        if (typeof files === 'string') files = [ files ]
        for (const file of files) {
          const absolute = path.resolve(this.directory, file)
          const relative = path.relative(this.directory, absolute)
          assert(isRelative(relative), `File "${file}" not relative to "${this.directory}"`)
          assert(isDecendant(relative), `File "${file}" not relative to "${this.directory}"`)
          set.add(relative)
        }
        return this
      },

      merge(...args: Files[]): FilesBuilder {
        for (const files of args) {
          for (const file of files.absolutePaths()) {
            this.push(file)
          }
        }
        return this
      },

      build(): Files {
        instance.#files.push(...set)
        instance.#files.sort()
        return instance
      },
    }
  }
}

function isRelative(arg: string): boolean {
  return ! path.isAbsolute(arg)
}

function isDecendant(arg: string): boolean {
  return arg === '..' ? false : ! arg.startsWith(`..${path.sep}`)
}
