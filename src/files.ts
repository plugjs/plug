import assert from 'node:assert'
import path from 'node:path'
import util from 'node:util'

import type { Run } from './run'

/** The {@link FilesBuilder} interface defines a builder for {@link Files}. */
export interface FilesBuilder {
  /** The (resolved) directory the {@link Files} will be associated with */
  readonly directory: string
  /** Push files into the {@link Files} instance being built */
  add(...files: string[]): this
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

  get length(): number {
    return this.#files.length
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

  /* Nicety for logging */
  [util.inspect.custom]() {
    const self = this
    return new class Files {
      directory = self.#directory
      files = [ ...self.#files ]
    }
  }

  /** Create a new {@link FilesBuilder} creating {@link Files} instances. */
  static builder(run: Run, directory?: string): FilesBuilder {
    const instance = new Files(run, directory)
    const set = new Set<string>()
    let built = false

    return {
      directory: instance.directory,

      add(...files: string[]): FilesBuilder {
        if (built) throw new Error('FileBuilder "build()" already called')

        if (typeof files === 'string') files = [ files ]
        for (const file of files) {
          const relative = assertRelativeChildPath(instance.directory, file)
          set.add(relative)
        }
        return this
      },

      merge(...args: Files[]): FilesBuilder {
        if (built) throw new Error('FileBuilder "build()" already called')

        for (const files of args) {
          for (const file of files.absolutePaths()) {
            this.add(file)
          }
        }
        return this
      },

      build(): Files {
        if (built) throw new Error('FileBuilder "build()" already called')

        built = true
        instance.#files.push(...set)
        instance.#files.sort()
        return instance
      },
    }
  }
}

export function assertRelativeChildPath(directory: string, file: string): string {
  const relative = getRelativeChildPath(directory, file)
  assert(relative, `File "${file}" not relative to "${directory}"`)
  return relative
}

export function getRelativeChildPath(directory: string, file: string): string | undefined {
  assert(path.isAbsolute(directory), `Directory "${directory}" not absolute`)
  const abs = path.resolve(directory, file)
  const rel = path.relative(directory, abs)
  if (path.isAbsolute(rel) || (rel === '..') || rel.startsWith(`..${path.sep}`)) {
    return undefined
  }
  return rel
}
