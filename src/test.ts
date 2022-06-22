import { AsyncLocalStorage } from 'node:async_hooks'
import type { Logger } from './log'

export type TestBaseMessage = { id: number }

export type TestStartMessage = TestBaseMessage & { event: 'start', label: string, parent: number }
export type TestPassMessage = TestBaseMessage & { event: 'pass' }
export type TestSkipMessage = TestBaseMessage & { event: 'skip' }
export type TestFailMessage = TestBaseMessage & { event: 'fail', failure: any}
export type TestLogMessage = TestBaseMessage & { event: 'log', level: keyof Logger, args: any[] }

export type TestNotifyMessage = TestStartMessage | TestPassMessage | TestSkipMessage | TestFailMessage | TestLogMessage

export type TestMessage = TestNotifyMessage & { test_run_uuid: string }

/* ========================================================================== *
 * MOCHA-LIKE INTERFACE                                                       *
 * ========================================================================== */

export interface TestContext {
  // timeout(): void
  skip(): void
  log: Logger
}

export type TestFunction = (context: TestContext) => void | Promise<void>

export type MochaFunction = ((label: string, fn: TestFunction) => void) & {
  readonly only: (label: string, fn: TestFunction) => void
  readonly skip: (label: string, fn: TestFunction) => void
}

export const describe = makeMochaFunction('describe')
export const it = makeMochaFunction('it')

function makeMochaFunction(name: string): MochaFunction {
  function test(label: string, fn: TestFunction) {
    const test = new Test(label, fn)
    currentTest().add(test)
  }

  function only(label: string, fn: TestFunction) {
    const test = new Test(label, fn)
    test.only = true
    currentTest().add(test)
  }

  function skip(label: string, fn: TestFunction) {
    const test = new Test(label, fn)
    test.skip = true
    currentTest().add(test)
  }

  Object.defineProperty(only, 'name', { value: `${name}.only` })
  Object.defineProperty(skip, 'name', { value: `${name}.skip` })
  return Object.defineProperties(test as MochaFunction, {
    name: { value: name, enumerable: false, configurable: false },
    only: { value: only, enumerable: false, configurable: false },
    skip: { value: skip, enumerable: false, configurable: false },
  })
}

/* ========================================================================== *
 * TEST INTERNALS                                                             *
 * ========================================================================== */

type TestNotify = <T extends TestNotifyMessage>(message: T) => void

class Test {
  static #lastId = 0

  readonly id = Test.#lastId ++
  readonly label
  readonly fn: TestFunction
  readonly tests: Test[] = []
  #flag?: 'skip' | 'only' | undefined

  constructor(label: string, fn: TestFunction) {
    this.label = label
    this.fn = fn
  }

  get only(): boolean {
    return this.#flag === 'only'
  }

  set only(only: boolean) {
    if (only) this.#flag = 'only'
  }

  get skip(): boolean {
    return this.#flag === 'skip'
  }

  set skip(skip: boolean) {
    if (skip) this.#flag = 'skip'
  }

  add(test: Test): this {
    this.tests.push(test)
    return this
  }

  async run(notify: TestNotify, parent?: Test): Promise<void> {
    notify({ event: 'start', id: this.id, parent: parent?.id || 0, label: this.label })
    try {
      /* If this is skipped, simply notify and return */
      if (this.skip) {
        notify({ event: 'skip', id: this.id })
        return
      }

      /* Create our context */
      const log = (level: keyof Logger, args: any[]): Logger => {
        notify({ event: 'log', id: this.id, level, args })
        return context.log
      }

      const context: TestContext = {
        skip: () => void (this.skip = true),
        log: {
          trace: (...args: any[]) => log('trace', args),
          debug: (...args: any[]) => log('debug', args),
          info: (...args: any[]) => log('info', args),
          warn: (...args: any[]) => log('warn', args),
          error: (...args: any[]) => log('error', args),
          sep: () => log('sep', []),
        }
      }

      const fn = this.fn.bind(context, context)

      /* Run the function, it _may_ contextualize other tasks */
      try {
        await storage.run(this, fn)
      } catch (error) {
        notify({ event: 'fail', id: this.id, failure: error })
        return
      }

      /* We might have called "skip()" in our context */
      if (this.skip) {
        notify({ event: 'skip', id: this.id })
        return
      }

      /* If any test is "only" all other tests will be skipped */
      const only = this.tests.reduce((p, t) => p || t.only, false)
      if (only) this.tests.forEach((t) => t.skip = ! t.only)

      /* Now run all other tests */
      for (const test of this.tests) await test.run(notify, this)

      /* All done! */
      notify({ event: 'pass', id: this.id })
    } catch (error) {
      console.error('Unhandled error running test', error)
    }
  }
}

const storage = new AsyncLocalStorage<Test>()
const rootTest = new Test('root', () => {})
function currentTest(): Test {
  return storage.getStore() || rootTest
}

process.nextTick(() => {
  if (process.send && process.env.__TEST_RUN_UUID__) {
    const test_run_uuid = process.env.__TEST_RUN_UUID__

    function send(notification: TestNotifyMessage): void {
      const message: TestMessage = { ...notification, test_run_uuid }
      process.send!(message, (error: any) => {
        if (error) console.error('Error sending message', error)
      })
    }

    rootTest.run(send)
  }
})
