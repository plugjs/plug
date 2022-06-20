import type { Run } from './run'
import type { Files } from './files'

export interface Plug {
  pipe(run: Run, files: Files): Files | Promise<Files>
}

export type PlugFunction = Plug['pipe']

export class Pipe implements Promise<Files> {
  #promise: Promise<Files>
  #run: Run

  constructor(run: Run, files: Files)
  constructor(run: Run, fn: () => Files | Promise<Files>)
  constructor(run: Run, filesOrFn: Files | (() => Files | Promise<Files>)) {
    if (typeof filesOrFn === 'function') {
      this.#promise = Promise.resolve().then(() => filesOrFn())
    } else {
      this.#promise = Promise.resolve(filesOrFn)
    }
    this.#run = run
  }

  plug(plug: Plug): this
  plug(plug: PlugFunction): this
  plug(arg: Plug | PlugFunction): this {
    /* Normalize our argument as a `Plug` instance */
    const plug = typeof arg === 'function' ? { pipe: arg } : arg

    /* Attach this plug to the promise chain and return */
    this.#promise = this.#promise.then((files) => plug.pipe(this.#run, files))
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

  /** Promises must always have a `Symbol.toStringTag` */
  readonly [Symbol.toStringTag] = 'Pipe'
}
