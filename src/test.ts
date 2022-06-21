import { AsyncLocalStorage } from 'node:async_hooks'
import { assert } from 'node:console'

export type TestBaseMessage = { id: number }
export type TestStartMessage = TestBaseMessage & { event: 'start', label: string, parent: number }
export type TestPassMessage = TestBaseMessage & { event: 'pass' }
export type TestSkipMessage = TestBaseMessage & { event: 'skip' }
export type TestFailMessage = TestBaseMessage & { event: 'fail', failure: any}
export type TestNotifyMessage = TestStartMessage | TestPassMessage | TestSkipMessage | TestFailMessage
export type TestMessage = TestNotifyMessage & { test_run_uuid: string }

/* ========================================================================== *
 * MOCHA-LIKE INTERFACE                                                       *
 * ========================================================================== */

type Message =
  | { event: 'start', id: number, label: string }
  | { event: 'fail', id: number, failure: any }
  | { event: 'pass', id: number }
  | { event: 'skip', id: number }

export interface TestContext {
  // timeout(): void
  // skip(): void
}

export type TestFunction = () => void | Promise<void>

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
  #flag?: 'skip' | 'only' | undefined

  readonly id = Test.#lastId ++
  readonly label
  readonly fn: TestFunction
  readonly tests: Test[] = []

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

  async run(send: TestNotify, parent?: Test): Promise<boolean> {
    if (this.skip) return true

    await storage.run(this, this.fn)

    if (this.skip) {
      this.tests.forEach((test) => test.skip = true)
    } else {
      const only = this.tests.reduce((p, t) => p || t.only, false)
      if (only) this.tests.forEach((t) => t.skip = ! t.only)
    }

    for (const test of this.tests) {
      send({ event: 'start', id: test.id, parent: this.id, label: test.label })

      let message: TestNotifyMessage
      try {
        const skipped = await test.run(send)
        message = { event: skipped ? 'skip' : 'pass', id: test.id, parent: this.id }
      } catch (error) {
        message = { event: 'fail', id: test.id, failure: error }
      } finally {
        send(message!)
      }

    }

    return this.skip
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
