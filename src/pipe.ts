import type { Files } from './files'
import type { Run } from './run'

export interface Plug {
  pipe(files: Files, run: Run): Files | Promise<Files>
}

export type PlugFunction = Plug['pipe']

export interface Pipe {
  plug(plug: Plug): this
  plug(plug: PlugFunction): this
}

export class Pipe implements Pipe {
  readonly #plugs: Plug[] = [] // esplicitly hidden to allow pipes extension
  readonly #start: (run: Run) => Pipe | Files | Promise<Files>

  constructor(start: ((run: Run) => Pipe | Files | Promise<Files>)) {
    if (typeof start === 'function') {
      this.#start = start
    } else {
      this.#start = (run: Run) => Pipe._run(start, run)
    }
  }

  plug(plug: Plug): this
  plug(plug: PlugFunction): this
  plug(plug: Plug | PlugFunction): this {
    this.#plugs.push(typeof plug === 'function' ? { pipe: plug } : plug)
    return this
  }

  private static _run(pipe: Pipe, run: Run): Promise<Files> {
    return pipe.#plugs.reduce((prev, plug) => {
      return prev.then((curr) => plug.pipe(curr, run))
    }, Promise.resolve().then(async () => {
      const result = await pipe.#start(run)
      return 'plug' in result ? Pipe._run(result, run) : result
    }))
  }
}

export function runPipe(pipe: Pipe, run: Run): Promise<Files> {
  return (<any> Pipe)._run(pipe, run)
}
