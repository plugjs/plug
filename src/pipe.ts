import type { Files } from './files'
import type { Run } from './run'

export interface Plug {
  pipe(files: Files, run: Run): Files | void | Promise<Files | void>
}

export type PlugFunction = Plug['pipe']

export interface Pipe extends Promise<Files | void> {
  plug(plug: Plug): this
  plug(plug: PlugFunction): this
}

export class Pipe implements Pipe {
  #promise: Promise<Files | void>
  readonly #run: Run

  constructor(start: Files | void | Promise<Files | void>, run: Run) {
    this.#promise = Promise.resolve().then(() => start)
    this.#run = run
  }

  plug(plug: Plug): this
  plug(plug: PlugFunction): this
  plug(arg: Plug | PlugFunction): this {
    const plug = typeof arg === 'function' ? { pipe: arg } : arg
    this.#promise = this.#promise.then((files) => {
      if (! files) files = this.#run.files().build()
      return plug.pipe(files, this.#run)
    })
    return this
  }

  then<T1 = Files, T2 = never>(
    onfulfilled?: ((value: Files | void) => T1 | PromiseLike<T1>) | null | undefined,
    onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null | undefined
  ): Promise<T1 | T2> {
    return this.#promise.then(onfulfilled, onrejected)
  }

  catch<T = never>(
    onrejected?: ((reason: any) => T | PromiseLike<T>) | null | undefined
  ): Promise<T | Files | void> {
    return this.#promise.catch(onrejected)
  }

  finally(
    onfinally?: (() => void) | null | undefined
  ): Promise<Files | void> {
    return this.#promise.finally(onfinally)
  }
}
