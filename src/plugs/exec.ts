import path from 'node:path'
import reaadline from 'node:readline'

import { spawn, SpawnOptions } from 'node:child_process'
import { assert } from '../assert'
import { runContext } from '../async'
import { Files } from '../files'
import { $p, logOptions } from '../log'
import { AbsolutePath, getCurrentWorkingDirectory, resolveDirectory } from '../paths'
import { install, PipeParameters } from '../pipe'
import { Plug, RunContext } from '../types'
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
     *     this.find('*.ts', { directory: 'src' })
     *       .exec('chmod', '755' })
     *       .exec('chown root:root', { shell: true })
     *   },
     * })
     * ```
     *
     * @param cmd The command to execute
     * @param args Any additional argument for the command to execute
     */
    exec(cmd: string, ...args: string[]): Pipe

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
     *     this.find('*.ts', { directory: 'src' })
     *       .exec('chmod', '755' })
     *       .exec('chown root:root', { shell: true })
     *   },
     * })
     * ```
     *
     * @param cmd The command to execute
     * @param args Any additional argument for the command to execute
     * @param options Extra {@link ExecOptions | options} for process execution
     */
    exec(cmd: string, ...extra: [ ...args: string[], options: ExecOptions ]): Pipe
  }
}

/* ========================================================================== *
 * INSTALLATION / IMPLEMENTATION                                              *
 * ========================================================================== */

install('exec', class Exec implements Plug<Files> {
  private readonly _cmd: string
  private readonly _args: readonly string[]
  private readonly _options: ExecOptions

  constructor(...args: PipeParameters<'exec'>)
  constructor(cmd: string, ...args: ParseOptions<ExecOptions>) {
    const { params, options } = parseOptions(args, {})
    this._cmd = cmd
    this._args = params
    this._options = options
  }

  async pipe(files: Files, run: RunContext): Promise<Files> {
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
})

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
 *
 * @param cmd The command to execute
 * @param args Any additional argument for the command to execute
 */
export function exec(cmd: string, ...args: string[]): Promise<void>

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
 *     await exec('ls -la /', { shell: true })
 *   },
 * })
 * ```
 *
 * @param cmd The command to execute
 * @param args Any additional argument for the command to execute
 * @param options Extra {@link ExecOptions | options} for process execution
 */
export function exec(cmd: string, ...extra: [ ...args: string[], options: ExecOptions ]): Promise<void>

/* Overloads implementation */
export function exec(cmd: string, ...args: ParseOptions<ExecOptions>): Promise<void> {
  const run = runContext()
  assert(run, 'Unable to execute commands outside a running task')

  const { params, options } = parseOptions(args, {})
  return spawnChild(cmd, params, options, run)
}


/* ========================================================================== *
 * INTERNALS                                                                  *
 * ========================================================================== */

async function spawnChild(
    cmd: string,
    args: readonly string[],
    options: ExecOptions = {},
    run: RunContext,
): Promise<void> {
  const {
    env = {}, // default empty environment
    shell = false, // by default do not use a shell
    cwd = undefined, // by default use "process.cwd()"
    ...extraOptions
  } = options

  const childCwd = cwd ? run.resolve(cwd) : getCurrentWorkingDirectory()
  assert(resolveDirectory(childCwd), `Current working directory ${$p(childCwd)} does not exist`)

  // Figure out the PATH environment variable
  const childPaths: AbsolutePath[] = []

  // The `.../node_modules/.bin` path relative to the current working dir */
  const baseNodePath = run.resolve('@node_modules', '.bin')
  if (resolveDirectory(baseNodePath)) childPaths.push(baseNodePath)

  // The `.../node_bodules/.bin` path relative to the buildDir */
  const buildNodePath = run.resolve('./node_modules', '.bin')
  if (resolveDirectory(buildNodePath)) childPaths.push(buildNodePath)

  // Any other paths either from `process.env` or `env` (which overrides it)
  const extraPath = env.PATH || process.env.PATH
  if (extraPath) childPaths.push(extraPath)

  // Build our environment variables record
  const PATH = childPaths.join(path.delimiter)
  const __LOG_OPTIONS = JSON.stringify(logOptions.fork(run.taskName))
  const childEnv = { ...process.env, ...env, PATH, __LOG_OPTIONS }

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
    out.on('line', (line) => line ? run.log.notice(line) : run.log.notice('\u00a0'))
  }

  if (child.stderr) {
    const err = reaadline.createInterface(child.stderr)
    err.on('line', (line) => line ? run.log.warn(line) : run.log.warn('\u00a0'))
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
