import { install } from '../pipe'
import { parseOptions } from '../utils/options'
import { execChild } from '../utils/exec'

import type { ExecChildOptions } from '../utils/exec'
import type { Files } from '../files'
import type { Context, PipeParameters, Plug } from '../pipe'

/** Options for executing scripts */
export interface ExecOptions extends ExecChildOptions {
  /**
   * The current working directory of the process to execute.
   *
   * Defaults to the current {@link Files.directory | Files' directory}.
   */
  cwd?: string
  /**
   * Whether the {@link Files} will be appended to the current arguments as
   * _relative_ files (default or `true`) or _absolute_ (if `false`).
   */
  relativePaths?: boolean
}

declare module '../index' {
  export interface Pipe {
    /**
     * Execute a shell command, adding to its _arguments_ the list of files
     * from the current pipe (much like `xargs` does on Unix systems).
     *
     * For example:
     *
     * ```
     * import { build } from '@plugjs/plugjs'
     *
     * export default build({
     *   runme() {
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
     * import { build } from '@plugjs/plugjs'
     *
     * export default build({
     *   runme() {
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

  constructor(...args: PipeParameters<'exec'>) {
    const { params, options } = parseOptions(args, {})
    const [ _cmd, ..._args ] = params
    this._cmd = _cmd
    this._args = _args
    this._options = options
  }

  async pipe(files: Files, context: Context): Promise<Files> {
    const { relativePaths = true, ...options } = this._options

    if (! options.cwd) options.cwd = files.directory

    // What to use as extra arguments? Relative or absolute paths?
    const params = [ ...(relativePaths ? files : files.absolutePaths() ) ]

    // In case of shell usage, each extra parameter (file) gets quoted!
    if (options.shell) params.forEach((s, i, a) => a[i] = JSON.stringify(s))

    // Run our child
    await execChild(this._cmd, [ ...this._args, ...params ], options, context)

    // Return our files
    return files
  }
})
