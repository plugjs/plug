import { invokeTasks, isBuild } from '../build'
import { ForkingPlug } from '../fork'
import { $p } from '../logging/colors'
import { requireFilename } from '../paths'

import type { Files } from '../files'
import type { ForkOptions } from '../fork'
import type { Context, Plug } from '../pipe'

/** Helper {@link Plug} used by the `invokeBuild` helper. */
export class RunBuildInternal implements Plug<void> {
  constructor(
      private readonly _tasks: readonly string[],
      private readonly _props: Readonly<Record<string, string>>,
  ) {}

  async pipe(files: Files, context: Context): Promise<void> {
    const tasks = this._tasks.length === 0 ? [ 'default' ] : this._tasks

    for (const file of files.absolutePaths()) {
      // Import and check build file
      let maybeBuild = await import(file)
      while (maybeBuild) {
        if (isBuild(maybeBuild)) break
        maybeBuild = maybeBuild.default
      }

      // We _need_ a build
      if (! isBuild(maybeBuild)) {
        context.log.fail(`File ${$p(file)} did not export a proper build`)
      } else {
        await invokeTasks(maybeBuild, tasks, this._props)
      }
    }
  }
}

export class RunBuild extends ForkingPlug {
  constructor(
      tasks: readonly string[],
      props: Readonly<Record<string, string>>,
      options: ForkOptions,
  ) {
    super(requireFilename(__fileurl), [ tasks, props, options ], RunBuildInternal.name)
  }
}
