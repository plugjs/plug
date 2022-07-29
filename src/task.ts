import type { BuildContext, TaskDefinition } from './build'
import type { Run } from './run'

import { Files } from './files'
import { $t, fail, log, TaskLogger } from './log'
import { AbsolutePath, Resolver } from './paths'
import { Pipe } from './pipe'
import { PlugContextImpl } from './plug'
import { FindOptions } from './types'
import { parseOptions, ParseOptions } from './utils/options'

/* ========================================================================== *
 * TASK                                                                       *
 * ========================================================================== */

 export interface Task {
  readonly name: string
  readonly buildFile: AbsolutePath
  readonly buildDir: AbsolutePath

  call(run: Run, context: BuildContext): Promise<Files>
}

export class TaskImpl implements Task {
  readonly buildFile: AbsolutePath
  readonly buildDir: AbsolutePath

  constructor(
    readonly name: string,
    private readonly _buildContext: BuildContext,
    private readonly _definition: TaskDefinition<any>,
  ) {
    this.buildFile = _buildContext.buildFile
    this.buildDir = _buildContext.buildDir
  }

  async call(run: Run, context: BuildContext): Promise<Files> {
    const pipes: Pipe[] = []

    console.log('RUNNING', this.name)

    const log = new TaskLogger() // TODO: logger!
    const taskContext = new TaskContextImpl(run, context, pipes)
    const plugContext = new PlugContextImpl(run, context, log)

    /* Call the `TaskDefinition` and await for results */
    const r = await this._definition.call(taskContext)

    console.log('rESUILT', this.name, r, pipes)
    const result = r && 'run' in r ? await r.run(plugContext) : r

    /* Any pipe created by calling this.xxx(...) gets awaited */
    const results = await Promise.all(pipes.map((pipe) => pipe.run(plugContext)))
    console.log('RESULTS', this.name, results)

    /* Return the result or an empty `Files` */
    return result || results.pop() || new Files(this._buildContext.buildDir)
  }
}

/* ========================================================================== *
 * TASK CONTEXT                                                               *
 * ========================================================================== */

/**
 * The {@link TaskContext} interface describes the value of `this` used
 * when calling a {@link TaskDefinition}s.
 */
 export interface TaskContext<D> {
  resolve(path: string, ...paths: string[]): AbsolutePath
  /** Find files {@link Pipe} with globs */
  find(glob: string, ...args: ParseOptions<FindOptions>): Pipe
  /** Call the specified {@link Task} from the current */
  call(task: keyof D): Pipe
}

export class TaskContextImpl extends Resolver implements TaskContext<any> {
  constructor(
    private readonly _run: Run,
    private readonly _context: BuildContext,
    private readonly _pipes: Pipe[],
  ) {
    super(_run, _context)
  }

  #createPipe(start: () => Promise<Files>): Pipe {
    const pipe = new Pipe(start)
    this._pipes.push(pipe)
    return pipe
  }

  find(glob: string, ...args: ParseOptions<FindOptions>): Pipe {
    return this.#createPipe(async (): Promise<Files> => {
      const { params, options: { directory, ...options} } = parseOptions(args, {})
      const dir = this.resolve(directory)
      return Files.find(dir, glob, ...params, options)
    })
  }

  call(name: string): Pipe {
    return this.#createPipe(async (): Promise<Files> => {
      const task = this._context.tasks[name]
      if (! task) fail(`No such task "${name}"`)
      log.debug('Calling task', $t(task))
      return this._run.call(task, this._context)
    })
  }
}
