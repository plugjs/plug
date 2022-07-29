import type { BuildContext, TaskDefinition, ThisBuild } from './build'
import type { Run } from './run'

import { Files } from './files'
import { TaskLogger } from './log'
import { Pipe } from './pipe'

/* ========================================================================== *
 * TASK                                                                       *
 * ========================================================================== */

 export interface Task {
  /**
   * The _original_ name of the task.
   *
   * Task names can change across different builds, and in the following
   * example, this property will always be `"original"` and never `"renamed"`.
   *
   * ```
   * const build1 = build({ original() { ... } })
   * const build2 = build({ renamed: build1.original })
   * ```
   */
  readonly name: string

  /**
   * The {@link BuildContext} of the _build_ where this task was originally
   * defined.
   */
  readonly context: BuildContext

  /** Invoked by the {@link Run} when actually executing this {@link Task} */
  call(run: Run): Promise<Files>
}

export class TaskImpl implements Task {
  constructor(
    readonly name: string,
    readonly context: BuildContext,
    private readonly _definition: TaskDefinition<any>,
  ) {}

  async call(run: Run): Promise<Files> {
    const pipes: Pipe[] = []

    const thisBuild: ThisBuild<any> = {}
    for (const [ name, task ] of Object.entries(run.tasks)) {
      thisBuild[name] = () => {
        const pipe = new Pipe(() => run.call(name))
        pipes.push(pipe)
        return pipe
      }
    }

    const r = await this._definition.call(thisBuild, run) // TODO
    const result = r && 'plug' in r ? await Pipe.run(r, run) : r

    /* Any pipe created by calling this.xxx(...) gets awaited */
    const results = await Promise.all(pipes.map((pipe) => Pipe.run(pipe, run)))

    /* Return the result or an empty `Files` */
    return result || results.pop() || new Files(run.buildDir)
  }
}
