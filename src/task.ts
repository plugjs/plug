import type { BuildContext, TaskDefinition, ThisBuild } from './build'
import type { Run } from './run'

import { Files } from './files'
import { TaskLogger } from './log'
import { Pipe } from './pipe'

/* ========================================================================== *
 * TASK                                                                       *
 * ========================================================================== */

export interface Task {
  /** The {@link BuildContext} of where this task was originally defined */
  readonly context: BuildContext

  /** Invoked by the {@link Run} when actually executing this {@link Task} */
  call(thisBuild: ThisBuild<any>, run: Run): Promise<Files | void>
}

export class TaskImpl implements Task {
  constructor(
      readonly context: BuildContext,
      private readonly _definition: TaskDefinition<any>,
  ) {}

  async call(self: ThisBuild<any>, run: Run): Promise<Files | void> {
    return await this._definition.call(self, self, run)
  }
}
