import path from 'node:path'

import type { Run } from './run'

import { Files } from './files'
import { log } from './log'

import { Pipe } from './pipe'
import { parseOptions, ParseOptions } from './utils/options'
import { walk, WalkOptions } from './utils/walk'

/* A `TaskCall` defines the callable component of a `Task` */
export type TaskCall = (build: Run) => Promise<Files>

export interface FindOptions extends WalkOptions {
  directory?: string
}

/** The contextual `this` argument used when callng `TaskDefinition`s */
export type ThisTasks<D> = {
  /** Resolve a file relative to the build file where this task was defined */
  resolve(file: string): string
  /** Find files relative to the current directory */
  find(...globs: ParseOptions<FindOptions>): Pipe
  /** Serially call other tasks sibling to this one */
  call(...tasks: (keyof D)[]): Pipe
  /** Call other tasks sibling to this one in parallel */
  parallel(...tasks: (keyof D)[]): Pipe
}

/** A `TaskDefinition` is a _function_ defining a `Task` */
export type TaskDefinition = (this: ThisTasks<any>) =>
  | Files | Promise<Files>
  | Pipe | Promise<Pipe>
  | void | Promise<void>

/** Take a `TaskDefinition` and return a callable `TaskCall` */
export function taskCall(definition: TaskDefinition, file: string): TaskCall {
  const directory = path.dirname(file)

  return async function _call(run: Run): Promise<Files> {
    const self = new Self(directory)

    const result = await definition.call(self)
    console.log('RESULT IS', result)

    for (const pipe of self.pipes) {
      if (pipe !== result) await pipe.run(run)
    }
    // console.log('EXTRA', self.pipes.length, 'PIPES CALLED')

    if (! result) return Files.builder(run.directory).build()
    if (result instanceof Files) return result

    console.log('RUNNING RETURNED PIPE')
    return result.run(run) // todo: pipe might have run already!
  }
}

class Self implements ThisTasks<any> {
  #directory: string
  #pipes: Pipe[] = []

  constructor(directory: string) {
    this.#directory = directory
  }

  get pipes(): Pipe[] {
    return this.#pipes
  }

  resolve(file: string) {
    return path.resolve(this.#directory, file)
  }

  find(...args: ParseOptions<FindOptions>): Pipe {
    const { globs, options } = parseOptions(args, {})

    const pipe = new Pipe().plug(async (run: Run): Promise<Files> => {
      log.info('Running pipe')
      const directory = options.directory ?
        path.resolve(options.directory) :
        run.directory

      const files = Files.builder(directory)
      for await (const file of walk(directory, ...globs, options)) {
        files.push(file)
      }

      return files.build()
    })

    this.#pipes.push(pipe)
    return pipe
  }

  call(...tasks: string[]): Pipe {
    const pipe = new Pipe().plug(async (run: Run): Promise<Files> => {
      const files = Files.builder(run.directory)

      console.log('CALLING TASKS', ...tasks)

      if (tasks.length === 0) return Files.builder(run.directory).build()
      for (const task of tasks) files.merge(await run.run(task))
      return files.build()
    })

    this.#pipes.push(pipe)
    return pipe
  }

  parallel(...tasks: string[]): Pipe {
    throw new Error('Unsupported')
    // return parallel(...tasks)
  }
}
