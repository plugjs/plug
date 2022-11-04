import path from 'node:path'
import reaadline from 'node:readline'
import { fork as forkProcess, spawn as spawnProcess } from 'node:child_process'

import { assert } from '../asserts'
import { $p, logOptions } from '../logging'
import { getCurrentWorkingDirectory, resolveDirectory } from '../paths'

import type { SpawnOptions } from 'node:child_process'
import type { AbsolutePath } from '../paths'
import type { Context } from '../pipe'

/** Options for executing scripts */
export interface ExecChildOptions {
  /** Specify the directory where coverage data will be saved */
  coverageDir?: string,
  /** Extra environment variables, or overrides for existing ones */
  env?: Record<string, any>,
  /** Whether to _fork_ the process (argument is a javascript file) or not */
  fork?: boolean,
  /** Whether to run the command in a shell (optionally name the shell) */
  shell?: string | boolean,
  /** The current working directory of the process to execute. */
  cwd?: string
}

export async function execChild(
    cmd: string,
    args: readonly string[],
    options: ExecChildOptions = {},
    context: Context,
): Promise<void> {
  const {
    env = {}, // default empty environment
    fork = false, // by default do not fork
    shell = false, // by default do not use a shell
    cwd = undefined, // by default use "process.cwd()"
    coverageDir, // default "undefined" (pass throug from env)
    ...extraOptions
  } = options

  const childCwd = cwd ? context.resolve(cwd) : getCurrentWorkingDirectory()
  assert(resolveDirectory(childCwd), `Current working directory ${$p(childCwd)} does not exist`)

  // Check for wrong fork/shell combination
  assert(fork && shell, 'Options "fork" and "shell" can not coexist')

  // Figure out the PATH environment variable
  const childPaths: AbsolutePath[] = []

  // The `.../node_modules/.bin` path relative to the current working dir */
  const baseNodePath = context.resolve('@node_modules', '.bin')
  if (resolveDirectory(baseNodePath)) childPaths.push(baseNodePath)

  // The `.../node_bodules/.bin` path relative to the buildDir */
  const buildNodePath = context.resolve('./node_modules', '.bin')
  if (resolveDirectory(buildNodePath)) childPaths.push(buildNodePath)

  // Any other paths either from `process.env` or `env` (which overrides it)
  const extraPath = env.PATH || process.env.PATH
  if (extraPath) childPaths.push(extraPath)

  // Build our environment variables record
  const PATH = childPaths.join(path.delimiter)
  const __LOG_OPTIONS = JSON.stringify(logOptions.fork(context.taskName))
  const childEnv: Record<string, string> = { ...process.env, ...env, PATH, __LOG_OPTIONS }

  // Instrument coverage directory if needed
  if (coverageDir) childEnv.NODE_V8_COVERAGE = context.resolve(coverageDir)

  // Prepare the options for calling `spawn`
  const childOptions: SpawnOptions = {
    ...extraOptions,
    stdio: [ 'ignore', 'pipe', 'pipe' ],
    cwd: childCwd,
    env: childEnv,
    shell,
  }

  // Spawn our subprocess and monitor its stdout/stderr
  context.log.info('Executing', [ cmd, ...args ])
  context.log.info('Execution options', childOptions)
  const child = fork ?
    forkProcess(cmd, args, childOptions) :
    spawnProcess(cmd, args, childOptions)

  // Standard output to "notice"
  if (child.stdout) {
    const out = reaadline.createInterface(child.stdout)
    out.on('line', (line) => line ? context.log.notice(line) : context.log.notice('\u00a0'))
  }

  // Standard error to "warning"
  if (child.stderr) {
    const err = reaadline.createInterface(child.stderr)
    err.on('line', (line) => line ? context.log.warn(line) : context.log.warn('\u00a0'))
  }

  // Return our promise from the spawn events
  return new Promise<void>((resolve, reject) => {
    child.on('error', (error) => reject(error))
    child.on('exit', (code, signal) => {
      if (code === 0) return resolve()
      if (signal) return reject(new Error(`Child process exited with signal ${signal}`))
      if (code) return reject(new Error(`Child process exited with code ${code}`))
      reject(new Error('Child process failed for an unknown reason'))
    })
  })
}
