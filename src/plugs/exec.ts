import { ChildProcess, spawn, SpawnOptions } from 'child_process'
import reaadline from 'readline'
import path from 'path'
import { Files } from '../files'
import { TaskLogger } from '../log'
import { Plug } from '../pipe'
import { Run } from '../run'

export interface ExecOptions<T> {
  cmd: T,
  args?: string[],
  cwd?: string,
  env?: Record<string, any>,
  shell?: string | boolean,
}

function runChild(child: ChildProcess): Promise<void> {
  const log = new TaskLogger()

  if (child.stdout) {
    const out = reaadline.createInterface(child.stdout)
    out.on('line', (line) => log.info(line))
  }

  if (child.stderr) {
    const err = reaadline.createInterface(child.stderr)
    err.on('line', (line) => log.info(line))
  }

  return new Promise<void>((resolve, reject) => {
    child.on('error', (error) => reject(error))
    child.on('exit', (code, signal) => {
      if (code === 0) return resolve()
      if (signal) return reject(new Error(`Child process exited with signal ${signal}`))
      if (code) return reject(new Error(`Child process exited with code ${code}`))
      reject(new Error(`Child process failed for an unknown reason`))
    })
  })
}

export class Exec implements Plug {
  #options: ExecOptions<string>

  constructor(cmdOrOptions: string | ExecOptions<string>) {
    this.#options =
      typeof cmdOrOptions === 'string' ?
        { cmd: cmdOrOptions } :
        cmdOrOptions
  }

  async pipe(run: Run, files: Files): Promise<Files> {
    const { cmd, args, env, ...options } = this.#options

    const extraPath = path.join(run.directory, 'node_modules', '.bin')

    const spawnEnv = {
      ...process.env,
      ...env,
      PATH: `${extraPath}${path.delimiter}${process.env.PATH}`
    }

    let child: ChildProcess
    const spawnOptions: SpawnOptions = {
      stdio: [ 'ignore', 'pipe', 'pipe' ],
      env: spawnEnv,
      ...options
    }

    if (args) {
      child = spawn(cmd, args, { ...spawnOptions })
    } else {
      child = spawn(cmd, { shell: true, ...spawnOptions })
    }

    await runChild(child)
    return files
  }
}

export function exec(cmdOrOptions: string | ExecOptions<string>): Exec {
  return new Exec(cmdOrOptions)
}
