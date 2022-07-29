import { Files } from './files'
import { Plug, PlugContext, PlugFunction } from './plug'

export class Pipe {
  private readonly _plugs: Plug[] = []

  constructor(
    private readonly _start: () => Files | Promise<Files>,
  ) {}

  plug(plug: Plug): this
  plug(plug: PlugFunction): this
  plug(plug: Plug | PlugFunction): this {
    this._plugs.push(typeof plug === 'function' ? { pipe: plug } : plug)
    return this
  }

  run(context: PlugContext): Promise<Files> {
    return this._plugs.reduce((prev, plug) => {
      return prev.then((curr) => plug.pipe(curr, context))
    }, Promise.resolve().then(() => this._start()))
  }
}
