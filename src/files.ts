import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import util from 'node:util'
import { requireRun } from './async'
import { Run } from './run'

export interface FilesBuilder {
  push(...files: string[]): this
  merge(...files: Files[]): this
  build(): Files
}

export class Files {
  #directory: string
  #files: string[]

  constructor(directory?: string)
  constructor(directory: string = '.') {
    directory = path.resolve(requireRun().directory, directory)
    assert(fs.statSync(directory).isDirectory(), `Invalid directory "${directory}"`)

    this.#directory = directory
    this.#files = []
  }

  get directory(): string {
    return this.#directory
  }

  [util.inspect.custom]() {
    const self = this
    return new class Files {
      directory = self.#directory
      files = [ ...self.#files ]
    }
  }

  *[Symbol.iterator](): Generator<string> {
    for (const file of this.#files) yield file
  }

  *absolutePaths(): Generator<string> {
    for (const file of this) yield path.resolve(this.#directory, file)
  }

  *pathMappings(): Generator<[ relative: string, absolute: string ]> {
    for (const file of this) yield [ file, path.resolve(this.#directory, file) ]
  }

  builder(): FilesBuilder {
    return Files.builder(this.#directory)
  }

  static builder(directory?: string): FilesBuilder {
    const instance = new Files(directory)
    const set = new Set<string>()

    return {
      push(...files: string[]): FilesBuilder {
        if (typeof files === 'string') files = [ files ]
        for (const file of files) {
          const absolute = path.resolve(instance.directory, file)
          const relative = path.relative(instance.directory, absolute)
          assert(isRelative(relative), `File "${file}" not relative to "${instance.directory}"`)
          assert(isDecendant(relative), `File "${file}" not relative to "${instance.directory}"`)
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
        instance.#files = [ ...set ].sort()
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
