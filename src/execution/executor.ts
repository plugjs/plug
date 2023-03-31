import assert from 'node:assert'
import { EventEmitter } from 'node:events'

import { Spec, Suite, Hook } from './executable'

import type { Executor } from './executable'

/* ========================================================================== */

export interface ExecutionFailure {
  error: Error,
}

export interface SuiteExecutionFailure extends ExecutionFailure {
  suite: Suite,
}

export interface SpecExecutionFailure extends ExecutionFailure {
  spec: Spec,
}

export interface HookExecutionFailure extends ExecutionFailure {
  hook: Hook,
}

export interface ExecutionEvents {
  'suite:start': (suite: Suite) => void
  'suite:done': (suite: Suite, time: number) => void

  'spec:start': (spec: Spec) => void
  'spec:error': (spec: Spec, failure: SpecExecutionFailure) => void
  'spec:skip': (spec: Spec, time: number) => void
  'spec:pass': (spec: Spec, time: number) => void
  'spec:fail': (spec: Spec, time: number, failure: SpecExecutionFailure) => void

  'hook:start': (hook: Hook) => void
  'hook:error': (hook: Hook, failure: HookExecutionFailure) => void
  'hook:skip': (hook: Hook, time: number) => void
  'hook:pass': (hook: Hook, time: number) => void
  'hook:fail': (hook: Hook, time: number, failure: HookExecutionFailure) => void
}

export interface Execution {
  on<E extends keyof ExecutionEvents>(event: E, listener: ExecutionEvents[E]): this
  off<E extends keyof ExecutionEvents>(event: E, listener: ExecutionEvents[E]): this
  once<E extends keyof ExecutionEvents>(event: E, listener: ExecutionEvents[E]): this
  result: Promise<ExecutionResult>
}

export interface ExecutionResult {
  specs: number
  passed: number
  failed: number
  skipped: number
  time: number
  failures: ExecutionFailure[],
}

/* ========================================================================== */

export function runSuite(suite: Suite): Execution {
  const _emitter = new EventEmitter()

  let resolve: (value: ExecutionResult | PromiseLike<ExecutionResult>) => void
  let reject: (reason?: any) => void
  const promise = new Promise<ExecutionResult>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })

  const result: ExecutionResult = {
    time: 0,
    specs: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: [],
  }

  const execution: Execution = {
    result: promise,
    on: (event: string, listener: (...args: any[]) => void): Execution => {
      _emitter.on(event, listener)
      return execution
    },
    off: (event: string, listener: (...args: any[]) => void): Execution => {
      _emitter.off(event, listener)
      return execution
    },
    once: (event: string, listener: (...args: any[]) => void): Execution => {
      _emitter.once(event, listener)
      return execution
    },
  }

  const start = (executable: Suite | Spec | Hook): ReturnType<Executor['start']> => {
    const type =
      executable instanceof Suite ? 'suite' :
      executable instanceof Spec ? 'spec' :
      executable instanceof Hook ? 'hook' :
      /* coverage ignore next */
      assert.fail(`Unable to start ${Object.getPrototypeOf(executable)?.constructor?.name}`)

    const now = Date.now()
    _emitter.emit(`${type}:start`, executable)
    if (type === 'spec') result.specs ++

    const failures: ExecutionFailure[] = []
    let done = false

    return {
      done(skipped: boolean = false): void {
        const time = Date.now() - now
        done = true

        if (type === 'suite') {
          _emitter.emit(`${type}:done`, executable, time)
          return
        }

        if (failures.length) {
          _emitter.emit(`${type}:fail`, executable, time, failures)
          if (type === 'spec') result.failed ++
        } else if (skipped) {
          _emitter.emit(`${type}:skip`, executable, time)
          if (type === 'spec') result.skipped ++
        } else {
          _emitter.emit(`${type}:pass`, executable, time)
          if (type === 'spec') result.passed ++
        }
      },
      notify(error: Error): void {
        const failure = { error, [type]: executable }
        result.failures.push(failure)

        // notify error after done, or include in failure?
        if (done) {
          _emitter.emit(`${type}:error`, executable, failure)
        } else {
          failures.push(failure)
        }
      },
    }
  }

  setImmediate(() => Promise.resolve().then(async () => {
    const now = Date.now()
    await suite.setup()
    await suite.execute({ start })

    result.time = Date.now() - now

    resolve(result)
  }).catch((error) => reject(error)))

  return execution
}
