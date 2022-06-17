import type { Run } from './run'
import { Files } from './files'

export type PlugFunction = (run: Run, files: Files) => Files | Promise<Files>

export interface Plug {
  pipe: PlugFunction
}

export class Pipe {
  #plugs: Plug[] = []
  #run: Run

  constructor(run: Run) {
    this.#run = run
  }

  async run(): Promise<Files> {
    let files = Files.builder(this.#run.directory).build()
    for (const plug of this.#plugs) files = await plug.pipe(this.#run, files)
    return files
  }

  plug(plug: Plug): this
  plug(plug: PlugFunction): this
  plug(plug: Plug | PlugFunction): this {
    if (typeof plug === 'function') plug = { pipe: plug }
    this.#plugs.push(plug)
    return this
  }
}
