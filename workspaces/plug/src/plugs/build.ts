import { invokeTasks, isBuild } from '../build.ts'
import { ForkingPlug } from '../fork.ts'
import { $p } from '../logging/colors.ts'
import { requireFilename } from '../paths.ts'

import type { Files } from '../files.ts'
import type { ForkOptions } from '../fork.ts'
import type { Context, Plug } from '../pipe.ts'

export interface RunBuildOptions extends ForkOptions {
  /** The _current working directory_ to be set when running the build */
  cwd?: string
}

/** Helper {@link Plug} used by the `invokeBuild` helper. */
export class RunBuildInternal implements Plug<void> {
  constructor(
      private readonly _tasks: readonly string[],
      private readonly _props: Readonly<Record<string, string>>,
      private readonly _options: RunBuildOptions,
  ) {}

  async pipe(files: Files, context: Context): Promise<void> {
    const tasks = this._tasks.length === 0 ? [ 'default' ] : this._tasks

    const cwd = this._options.cwd || process.cwd()

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
        const dir = process.cwd()
        try {
          process.chdir(cwd)
          await invokeTasks(maybeBuild, tasks, this._props)
        } finally {
          process.chdir(dir)
        }
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
    super(requireFilename(import.meta.filename), [ tasks, props, options ], RunBuildInternal.name)
  }
}
