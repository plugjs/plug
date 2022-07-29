import { BuildContext } from './build'
import { Files, FilesBuilder } from './files'
import { Logger } from './log'
import { AbsolutePath, Resolver } from './paths'
import { Run } from './run'
import { FindOptions } from './types'
import { ParseOptions, parseOptions } from './utils/options'

export interface PlugContext {
  resolve(this: PlugContext, path: string): AbsolutePath
  files(this: PlugContext, path: string): FilesBuilder
  readonly log: Logger
}

export class PlugContextImpl extends Resolver implements PlugContext {
  constructor(run: Run, context: BuildContext, public log: Logger) {
    super(run, context)
  }

  files(path: string): FilesBuilder {
    return Files.builder(this.resolve(path))
  }

  async find(glob: string, ...args: ParseOptions<FindOptions>): Promise<Files> {
    const { params, options: { directory, ...options} } = parseOptions(args, {})
    const dir = this.resolve(directory)
    return Files.find(dir, glob, ...params, options)
  }
}

export interface Plug {
  pipe(files: Files, context: PlugContext): Files | Promise<Files>
}

export type PlugFunction = Plug['pipe']
