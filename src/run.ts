import { sep } from 'node:path'
import { getLogger, Logger } from './log'
import { AbsolutePath, getAbsoluteParent, getCurrentWorkingDirectory, resolveAbsolutePath } from './paths'
import { RunContext } from './types'

export class RunImpl implements RunContext {
  public readonly buildDir: AbsolutePath
  public readonly log: Logger

  constructor(
      public readonly buildFile: AbsolutePath,
      public readonly taskName: string,
  ) {
    this.buildDir = getAbsoluteParent(buildFile)
    this.log = getLogger(taskName)
  }

  resolve(path: string, ...paths: string[]): AbsolutePath {
    // Paths starting with "@" are relative to the build file directory
    if (path && path.startsWith('@')) {
      // We can have paths like "@/../foo/bar" or "@../foo/bar"... both are ok
      const components = path.substring(1).split(sep).filter((s) => !!s)
      return resolveAbsolutePath(this.buildDir, ...components, ...paths)
    }

    // No path? Resolve to the CWD!
    if (! path) return getCurrentWorkingDirectory()

    // For all the rest, normal resolution!
    return resolveAbsolutePath(getCurrentWorkingDirectory(), path, ...paths)
  }
}
