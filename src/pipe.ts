import type { Run } from './run'
import { Files } from './files'
import { requireRun } from './async'

export type PlugFunction = (run: Run, files: Files) => Files | Promise<Files>

export interface Plug {
  pipe: PlugFunction
}

export class Pipe extends Promise<Files> {
  constructor(files?: Files)
  constructor(filesOrExecutor?: (() => void) | Files) {
    // When subclassing a promise, we _might_ be called with an executor
    // function (that is, when the promise is `then`-ed). In this case, we
    // just call `super(...)` with said executor...
    if (typeof filesOrExecutor === 'function') {
      super(filesOrExecutor)
    } else {
      super((resolve) => resolve(filesOrExecutor || new Files()))
    }
  }

  plug(plug: Plug): Pipe
  plug(plug: PlugFunction): Pipe
  plug(arg: Plug | PlugFunction): Pipe {
    // Normalize our argument as a `Plug` instance
    const plug = typeof arg === 'function' ? { pipe: arg } : arg

    // We _extend_ a `Promise` so `then(...)` will definitely return `Pipe`,
    // but that instance won't have our `#run` specified (as it's not passed)
    // in the constructor. We just manually inject it here, for subsequent
    // calls...
    return this.then((files) => plug.pipe(requireRun(), files)) as Pipe
  }
}
