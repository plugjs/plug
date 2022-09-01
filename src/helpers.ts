import { assert } from './assert'
import { requireContext } from './async'
import { Files } from './files'
import { $p, log } from './log'
import { AbsolutePath, commonPath, getCurrentWorkingDirectory, resolveDirectory, resolveFile } from './paths'
import { Context, Pipe, Plug, PlugFunction, PlugResult } from './pipe'
import { rm } from './utils/asyncfs'
import { ParseOptions, parseOptions } from './utils/options'
import { walk, WalkOptions } from './utils/walk'

class PipeImpl extends Pipe implements Pipe {
  constructor(private readonly _start: (context: Context) => Promise<Files>) {
    super()
  }

  plug(plug: Plug<Files>): Pipe
  plug(plug: PlugFunction<Files>): Pipe
  plug(plug: Plug<void | undefined>): Promise<undefined>
  plug(plug: PlugFunction<void | undefined>): Promise<undefined>
  plug(arg: Plug<PlugResult> | PlugFunction<PlugResult>): Pipe | Promise<undefined> {
    const plug = typeof arg === 'function' ? { pipe: arg } : arg

    const parent = this
    return new PipeImpl(async (context: Context): Promise<Files> => {
      const files = await parent._start(context)
      const files2 = await plug.pipe(files, context)
      assert(files2, 'Unable to extend pipe (part tres)')
      return files2
    })
  }

  async run(): Promise<Files> {
    return this._start(requireContext())
  }
}

/** The {@link FindOptions} interface defines the options for finding files. */
export interface FindOptions extends WalkOptions {
  /** The directory where to start looking for files. */
  directory?: string
}


export function find(glob: string): Pipe
export function find(glob: string, ...globs: string[]): Pipe
export function find(glob: string, options: FindOptions): Pipe
export function find(glob: string, ...extra: [...globs: string[], options: FindOptions]): Pipe

export function find(...args: ParseOptions<FindOptions>): Pipe {
  const { params: globs, options } = parseOptions(args, {})

  return new PipeImpl(async (context: Context): Promise<Files> => {
    const directory = options.directory ?
      context.resolve(options.directory) :
      getCurrentWorkingDirectory()

    const builder = Files.builder(directory)
    for await (const file of walk(directory, globs, options)) {
      builder.add(file)
    }

    return builder.build()
  })
}

export function merge(...pipes: Pipe[]): Pipe {
  return new PipeImpl(async (): Promise<Files> => {
    if (pipes.length === 0) return Files.builder(getCurrentWorkingDirectory()).build()

    const results: Files[] = []

    for (const pipe of pipes) {
      const result = await pipe.run()
      assert(result, 'Pipe did not return a Files result')
      results.push(result)
    }

    const [ first, ...others ] = results

    const firstDir = first.directory
    const otherDirs = others.map((f) => f.directory)

    const directory = commonPath(firstDir, ...otherDirs)

    return Files.builder(directory).merge(first, ...others).build()
  })
}

/**
 * Recursively remove the specified directory _**(use with care)**_.
 */
export async function rmrf(directory: string): Promise<void> {
  const context = requireContext()
  const dir = context.resolve(directory)

  assert(dir !== getCurrentWorkingDirectory(),
      `Cowardly refusing to wipe current working directory ${$p(dir)}`)

  assert(dir !== context.resolve('@'),
      `Cowardly refusing to wipe build file directory ${$p(dir)}`)

  if (! resolveDirectory(dir)) {
    log.info('Directory', $p(dir), 'not found')
    return
  }

  log.notice('Removing directory', $p(dir), 'recursively')
  await rm(dir, { recursive: true })
}

/** Return an absolute path of the file if it exist on disk */
export function isFile(...paths: [ string, ...string[] ]): AbsolutePath | undefined {
  const path = requireContext().resolve(...paths)
  return resolveFile(path)
}

/** Return an absolute path of the file if it exist on disk */
export function isDirectory(...paths: [ string, ...string[] ]): AbsolutePath | undefined {
  const path = requireContext().resolve(...paths)
  return resolveDirectory(path)
}
