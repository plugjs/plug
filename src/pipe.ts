import type { Run } from './run'
import { Files } from './files'
import { requireRun } from './async'

export interface Plug {
  pipe(run: Run, files: Files): Files | Promise<Files>
}

export type PlugFunction = Plug['pipe']

export class Pipe implements Promise<Files> {
  readonly [Symbol.toStringTag] = 'Pipe'
  #promise: Promise<Files>

  constructor(files?: Files) {
    this.#promise = Promise.resolve(files || new Files())
  }

  plug(plug: Plug): this
  plug(plug: PlugFunction): this
  plug(arg: Plug | PlugFunction): this {
    /* Normalize our argument as a `Plug` instance */
    const plug = typeof arg === 'function' ? { pipe: arg } : arg

    /* Attach this plug to the promise chain and return */
    this.#promise = this.#promise.then((files) => plug.pipe(requireRun(), files))
    return this
  }

  then<R1 = Files, R2 = never>(
    onfulfilled?: ((value: Files) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.#promise.then(onfulfilled, onrejected)
  }

  catch<R = never>(
    onrejected?: ((reason: any) => R | PromiseLike<R>) | null,
  ): Promise<Files | R> {
    return this.#promise.catch(onrejected)
  }

  finally(onfinally?: (() => void) | null): Promise<Files> {
    return this.#promise.finally(onfinally)
  }
}
