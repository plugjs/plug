import { assert } from './assert'
import { runContext } from './async'
import { $p, log } from './log'
import { AbsolutePath, getCurrentWorkingDirectory, resolveDirectory, resolveFile } from './paths'
import { rm } from './utils/asyncfs'

/**
 * Recursively remove the specified directory _**(use with care)**_.
 */
export async function rmrf(directory: string): Promise<void> {
  const run = runContext()
  assert(run, 'Unable to determine current Run')
  const dir = run.resolve(directory)

  assert(dir !== getCurrentWorkingDirectory(),
      `Cowardly refusing to wipe current working directory ${$p(dir)}`)

  assert(dir !== run.resolve('@'),
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
  const run = runContext()
  assert(run, 'Unable to determine current Run')
  const path = run.resolve(...paths)

  return resolveFile(path)
}

/** Return an absolute path of the file if it exist on disk */
export function isDirectory(...paths: [ string, ...string[] ]): AbsolutePath | undefined {
  const run = runContext()
  assert(run, 'Unable to determine current Run')
  const path = run.resolve(...paths)

  return resolveDirectory(path)
}
