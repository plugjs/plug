import type { BuildContext, TaskDefinition, ThisBuild } from './build'
import type { Files } from './files'
import type { Run } from './run'

/* ========================================================================== *
 * TASK                                                                       *
 * ========================================================================== */

export interface Task<T extends Files | undefined = Files | undefined> {
  /** The {@link BuildContext} of where this task was originally defined */
  readonly context: BuildContext

  /** Invoked by the {@link Run} when actually executing this {@link Task} */
  call(thisBuild: ThisBuild<any>, run: Run): Promise<T>
}

export class TaskImpl implements Task<Files | undefined> {
  constructor(
      readonly context: BuildContext,
      private readonly _definition: TaskDefinition<any>,
  ) {}

  async call(self: ThisBuild<any>, run: Run): Promise<Files | undefined> {
    return (await this._definition.call(self, self, run)) || undefined
  }
}
