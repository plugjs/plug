import type { Run } from './run'
import { Files } from './files'
import { requireRun } from './async'
// import { requireRun } from './async'

export type PlugFunction = (run: Run, files: Files) => Files | Promise<Files>

export interface Plug {
  pipe: PlugFunction
}

export class Pipe implements Promise<Files> {
  readonly [Symbol.toStringTag] = 'Pipe'
  #promise: Promise<Files>

  constructor(files?: Files) {
    this.#promise = Promise.resolve(files || new Files())
  }

  plug(plug: Plug): this
  plug(plug: PlugFunction): this
  plug(arg: Plug | PlugFunction): this {
    // Normalize our argument as a `Plug` instance
    const plug = typeof arg === 'function' ? { pipe: arg } : arg

    // Replace our Promise with whatever we were plugged with
    this.#promise = this.#promise.then((files) => plug.pipe(requireRun(), files))

    // Done
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
