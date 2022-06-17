import type { Run } from './run'
import { Files } from './files'
import assert from 'node:assert'

export type PlugFunction = (run: Run, files: Files) => Files | Promise<Files>

export interface Plug {
  pipe: PlugFunction
}

export class Pipe extends Promise<Files> {
  #run!: Run

  constructor(run: Run, files?: Files)
  constructor(run: Run | (() => void), files?: Files) {
    // When subclassing a promise, we _might_ be called with an executor
    // function (that is, when the promise is `then`-ed). In this case, we
    // just call `super(...)` with said executor...
    if (typeof run === 'function') {
      super(run)
    } else {
      super((resolve) => resolve(files || new Files(run.directory)))
      this.#run = run
    }
  }

  plug(plug: Plug): Pipe
  plug(plug: PlugFunction): Pipe
  plug(arg: Plug | PlugFunction): Pipe {
    assert(this.#run, `Unable to plug components outside of invocation chain`)

    // Normalize our argument as a `Plug` instance
    const plug = typeof arg === 'function' ? { pipe: arg } : arg

    // We _extend_ a `Promise` so `then(...)` will definitely return `Pipe`,
    // but that instance won't have our `#run` specified (as it's not passed)
    // in the constructor. We just manually inject it here, for subsequent
    // calls...
    const promise = this.then((files) => plug.pipe(this.#run, files)) as Pipe
    promise.#run = this.#run
    return promise
  }
}
