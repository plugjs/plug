import { $p } from '../logging/colors'
import { ForkingPlug, type ForkOptions } from '../fork'
import { requireFilename } from '../paths'

import type { Files } from '../files'
import type { Context, Plug } from '../pipe'
import type { Build } from '../types'

/** Writes some info about the current {@link Files} being passed around. */
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
        await maybeBuild[buildMarker](tasks, this._props)
      }
    }
  }
}

/** Symbol indicating that an object is a {@link Build}. */
const buildMarker = Symbol.for('plugjs:isBuild')

/** Check if the specified build is actually a {@link Build} */
function isBuild(build: any): build is Build<Record<string, any>> & {
  [buildMarker]: (
    tasks: readonly string[],
    props?: Record<string, string | undefined>,
  ) => Promise<void>
} {
  return build && typeof build[buildMarker] === 'function'
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
