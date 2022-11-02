import { mkdir, writeFile } from './fs'
import { assertRelativeChildPath, getAbsoluteParent, resolveAbsolutePath } from './paths'

import type { AbsolutePath } from './paths'

/** The {@link FilesBuilder} interface defines a builder for {@link Files}. */
export interface FilesBuilder {
  /** The (resolved) directory the {@link Files} will be associated with */
  readonly directory: AbsolutePath

  /**
   * Push files into the {@link Files} instance being built.
   *
   * This method will not check that files actually exist on disk.
   */
  add(...files: string[]): this

  /** Merge orther {@link Files} instance to the {@link Files} being built */
  merge(...files: Files[]): this

  /** Write a file and add it to the {@link Files} instance being built */
  write(file: string, content: string | Uint8Array): Promise<AbsolutePath>

  /** Build and return a {@link Files} instance */
  build(): Files
}

/**
 * The {@link Files} class represents a collection of relative path names
 * identifying some _files_ rooted in a given _directory_.
 */
export class Files {
  readonly _directory: AbsolutePath
  readonly _files: string[]

  /**
   * Create a new {@link Files} instance rooted in the specified `directory`
   * relative to the specified {@link Run}'s directory.
   */
  constructor(directory: AbsolutePath) {
    this._directory = directory
    this._files = []

    // Nicety for "console.log" / "util.inspect"...
    const inspect = Symbol.for('nodejs.util.inspect.custom')
    Object.defineProperty(this, inspect, { value: () => ({
      directory: this._directory,
      files: [ ...this._files ],
    }) })
  }

  /** Return the _directory_ where this {@link Files} is rooted */
  get directory(): AbsolutePath {
    return this._directory
  }

  /** Return the number of files tracked by this instance. */
  get length(): number {
    return this._files.length
  }

  /** Return an iterator over all _relative_ files of this instance */
  * [Symbol.iterator](): Generator<string> {
    for (const file of this._files) yield file
  }

  /** Return an iterator over all _absolute_ files of this instance */
  * absolutePaths(): Generator<AbsolutePath> {
    for (const file of this) yield resolveAbsolutePath(this._directory, file)
  }

  /** Return an iterator over all _relative_ to _absolute_ mappings */
  * pathMappings(): Generator<[ relative: string, absolute: AbsolutePath ]> {
    for (const file of this) yield [ file, resolveAbsolutePath(this._directory, file) ]
  }

  /** Create a new {@link FilesBuilder} creating {@link Files} instances. */
  static builder(files: Files): FilesBuilder
  static builder(directory: AbsolutePath): FilesBuilder
  static builder(arg: Files | AbsolutePath): FilesBuilder {
    const directory = typeof arg === 'string' ? arg : arg.directory
    const set = typeof arg === 'string' ? new Set<string>() : new Set(arg._files)

    const instance = new Files(directory)
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

      async write(file: string, content: string | Uint8Array): Promise<AbsolutePath> {
        const relative = assertRelativeChildPath(instance.directory, file)
        const absolute = resolveAbsolutePath(instance.directory, relative)
        const directory = getAbsoluteParent(absolute)

        await mkdir(directory, { recursive: true })
        await writeFile(absolute, content)
        this.add(absolute)

        return absolute
      },

      build(): Files {
        if (built) throw new Error('FileBuilder "build()" already called')

        built = true
        instance._files.push(...set)
        instance._files.sort()
        return instance
      },
    }
  }
}
