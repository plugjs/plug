import { inspect } from 'node:util'
import { AbsolutePath, assertRelativeChildPath, getAbsoluteParent, resolveAbsolutePath } from './paths'
import { mkdir, writeFile } from './utils/asyncfs'

/** The {@link FilesBuilder} interface defines a builder for {@link Files}. */
export interface FilesBuilder {
  /** The (resolved) directory the {@link Files} will be associated with */
  readonly directory: AbsolutePath
  /** Push files into the {@link Files} instance being built */
  add(...files: string[]): void
  /** Merge orther {@link Files} instance to the {@link Files} being built */
  merge(...files: Files[]): void
  /** Write a file and add it to the {@link Files} instance being built */
  write(file: string, content: string | Buffer): Promise<AbsolutePath>
  /** Build and return a {@link Files} instance */
  build(): Files
}

/**
 * The {@link Files} class represents a collection of relative path names
 * identifying some _files_ rooted in a given _directory_.
 */
export class Files {
  readonly #directory: AbsolutePath
  readonly #files: string[]

  /**
   * Create a new {@link Files} instance rooted in the specified `directory`
   * relative to the specified {@link Run}'s directory.
   */
  constructor(directory: AbsolutePath) {
    this.#directory = directory
    this.#files = []
  }

  /** Return the _directory_ where this {@link Files} is rooted */
  get directory(): AbsolutePath {
    return this.#directory
  }

  /** Return the number of files tracked by this instance. */
  get length(): number {
    return this.#files.length
  }

  /** Return an iterator over all _relative_ files of this instance */
  * [Symbol.iterator](): Generator<string> {
    for (const file of this.#files) yield file
  }

  /** Return an iterator over all _absolute_ files of this instance */
  * absolutePaths(): Generator<AbsolutePath> {
    for (const file of this) yield resolveAbsolutePath(this.#directory, file)
  }

  /** Return an iterator over all _relative_ to _absolute_ mappings */
  * pathMappings(): Generator<[ relative: string, absolute: AbsolutePath ]> {
    for (const file of this) yield [ file, resolveAbsolutePath(this.#directory, file) ]
  }

  /* Nicety for logging */
  [inspect.custom](): any {
    const self = this
    return new class Files {
      directory = self.#directory
      files = [ ...self.#files ]
    }
  }

  /** Create a new {@link FilesBuilder} creating {@link Files} instances. */
  static builder(directory: AbsolutePath): FilesBuilder {
    const instance = new Files(directory)
    const set = new Set<string>()
    let built = false

    return {
      directory: instance.directory,

      add(...files: string[]): void {
        if (built) throw new Error('FileBuilder "build()" already called')

        if (typeof files === 'string') files = [ files ]
        for (const file of files) {
          const relative = assertRelativeChildPath(instance.directory, file)
          set.add(relative)
        }
      },

      merge(...args: Files[]): void {
        if (built) throw new Error('FileBuilder "build()" already called')

        for (const files of args) {
          for (const file of files.absolutePaths()) {
            this.add(file)
          }
        }
      },

      async write(file: string, content: string | Buffer): Promise<AbsolutePath> {
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
        instance.#files.push(...set)
        instance.#files.sort()
        return instance
      },
    }
  }
}
