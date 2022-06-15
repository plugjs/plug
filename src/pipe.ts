import type { Run } from './run'
import { Files } from './files'

export type PlugFunction = (run: Run, files: Files) => Files | Promise<Files>

export interface Plug {
  pipe: PlugFunction
}

export class Pipe {
  #plugs: Plug[] = []

  constructor() {
    // nothing to do here!
  }

  async run(run: Run): Promise<Files> {
    let files = Files.builder(run.directory).build()
    for (const plug of this.#plugs) files = await plug.pipe(run, files)
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
