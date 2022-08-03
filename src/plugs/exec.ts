import type { Files } from '../files'
import type { Run } from '../run'

import path from 'node:path'
import reaadline from 'node:readline'

import { spawn, SpawnOptions } from 'child_process'
import { assert } from '../assert'
import { currentRun } from '../async'
import { $p } from '../log'
import { AbsolutePath, getCurrentWorkingDirectory, isDirectory } from '../paths'
import { install, Plug } from '../pipe'
import { parseOptions, ParseOptions } from '../utils/options'

/** Options for executing scripts */
export interface ExecOptions {
  /** Extra environment variables, or overrides for existing ones */
  env?: Record<string, any>,
  /** Whether to run in the context of a _shell_ or not */
  shell?: string | boolean,
  /**
   * The current working directory of the process to execute.
   *
   * Defaults to the current {@link Files.directory | Files' directory} when
   * used as a {@link Plug} or `process.cwd()` when used from {@link exec}.
   */
  cwd?: string
  /**
   * When used as a {@link Plug}, the {@link Files} will be appended to the
   * current arguments as _relative_ files (default) or _absolute_ (if false).
   */
  relativePaths?: boolean
}

/**
 * Execute a shell command, adding to its _arguments_ the list of files from
 * the current pipe (much like `xargs` does on Unix systems).
 *
 * This {@link Plug} returns the same {@link Files} it was given, so that
 * executing a shell command doesn't interrupt a {@link Pipe}.
 *
 * For example:
 *
 * ```
 * import { find, exec } from '@plugjs/plugjs'
 *
 * export default build({
 *   async runme() {
 *     find('*.ts', { directory: 'src' })
 *       .plug(new Exec('chmod', '755' }))
 *       .plug(new Exec('chown root:root', { shell: true }))
 *   },
 * })
 * ```
 */
export class Exec implements Plug<Files> {
  private readonly _cmd: string
  private readonly _args: readonly string[]
  private readonly _options: ExecOptions

  constructor(cmd: string, ...args: ParseOptions<ExecOptions>) {
    const { params, options } = parseOptions(args, {})
    this._cmd = cmd
    this._args = params
    this._options = options
  }

  async pipe(files: Files, run: Run): Promise<Files> {
    const { relativePaths = true, ...options } = this._options

    if (! options.cwd) options.cwd = files.directory

    // What to use as extra arguments? Relative or absolute paths?
    const params = [ ...(relativePaths ? files : files.absolutePaths() ) ]

    // In case of shell usage, each extra parameter (file) gets quoted!
    if (options.shell) params.forEach((s, i, a) => a[i] = JSON.stringify(s))

    // Run our child
    await spawnChild(this._cmd, [ ...this._args, ...params ], options, run)

    // Return our files
    return files
  }
}

/**
 * Execute a command and await for its result from within a task.
 *
 * For example:
 *
 * ```
 * import { exec } from '@plugjs/plugjs'
 *
 * export default build({
 *   async runme() {
 *     await exec('ls', '-la', '/')
 *   },
 * })
 * ```
 */

export function exec(cmd: string, ...args: ParseOptions<ExecOptions>): Promise<void> {
  const run = currentRun()
  assert(run, 'Unable to execute commands outside a running task')

  const { params, options } = parseOptions(args, {})
  return spawnChild(cmd, params, options, run)
}


/* ========================================================================== *
 * INSTALLATION                                                               *
 * ========================================================================== */

install('exec', Exec)

declare module '../pipe' {
  export interface Pipe {
    /**
     * Execute a shell command, adding to its _arguments_ the list of files
     * from the current pipe (much like `xargs` does on Unix systems).
     *
     * For example:
     *
     * ```
     * import { find, exec } from '@plugjs/plugjs'
     *
     * export default build({
     *   async runme() {
     *     find('*.ts', { directory: 'src' })
     *       .exec('chmod', '755' })
     *       .exec('chown root:root', { shell: true })
     *   },
     * })
     * ```
     */
    exec: PipeExtension<typeof Exec>
  }
}

/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

async function spawnChild(
    cmd: string,
    args: readonly string[],
    options: ExecOptions = {},
    run: Run,
): Promise<void> {
  const {
    env = {}, // default empty environment
    shell = false, // by default do not use a shell
    cwd = undefined, // by default use "process.cwd()"
    ...extraOptions
  } = options

  const childCwd = cwd ? run.resolve(cwd) : getCurrentWorkingDirectory()
  assert(await isDirectory(childCwd), `Current working directory ${$p(childCwd)} does not exist`)

  // Figure out the PATH environment variable
  const childPaths: AbsolutePath[] = []

  // The `.../node_modules/.bin` path relative to the baseDir */
  const baseNodePath = run.resolve('@node_modules', '.bin')
  if (await isDirectory(baseNodePath)) childPaths.push(baseNodePath)

  // The `.../node_bodules/.bin` path relative to the buildDir */
  const buildNodePath = run.resolve('./node_modules', '.bin')
  if (await isDirectory(buildNodePath)) childPaths.push(buildNodePath)

  // Any other paths either from `process.env` or `env` (which overrides it)
  const extraPath = env.PATH || process.env.PATH
  if (extraPath) childPaths.push(extraPath)

  // Build our PATH environment variable
  const childPath = childPaths.join(path.delimiter)

  // Build our environment variables record
  const childEnv = { ...process.env, ...env, PATH: childPath }

  // Prepare the options for calling `spawn`
  const childOptions: SpawnOptions = {
    ...extraOptions,
    stdio: [ 'ignore', 'pipe', 'pipe' ],
    cwd: childCwd,
    env: childEnv,
    shell,
  }

  // Spawn our subprocess and monitor its stdout/stderr
  run.log.info('Executing', [ cmd, ...args ])
  run.log.info('Execution options', childOptions)
  const child = spawn(cmd, args, childOptions)

  if (child.stdout) {
    const out = reaadline.createInterface(child.stdout)
    out.on('line', (line) => line ? run.log.info(line) : run.log.sep())
  }

  if (child.stderr) {
    const err = reaadline.createInterface(child.stderr)
    err.on('line', (line) => line ? run.log.info(line) : run.log.sep())
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
