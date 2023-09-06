import { Hook, Spec, Suite, skip } from '../src/execution/executable'
import { runSuite } from '../src/execution/executor'

import type { Execution } from '../src/execution/executor'


function setupListeners(execution: Execution, calls: any[][]): void {
  const listener = (event: string) => {
    return (executable: Suite | Spec | Hook, ...args: any[]): void => {
      calls.push([ event, executable.name, ...args ])
    }
  }

  execution.on('suite:start', listener('suite:start'))
  execution.on('suite:done', listener('suite:done'))

  execution.on('spec:start', listener('spec:start'))
  execution.on('spec:error', listener('spec:error'))
  execution.on('spec:skip', listener('spec:skip'))
  execution.on('spec:pass', listener('spec:pass'))
  execution.on('spec:fail', listener('spec:fail'))

  execution.on('hook:start', listener('hook:start'))
  execution.on('hook:error', listener('hook:error'))
  execution.on('hook:skip', listener('hook:skip'))
  execution.on('hook:pass', listener('hook:pass'))
  execution.on('hook:fail', listener('hook:fail'))
}

describe('Executor', () => {
  it('should create and execute a suite, specs and hooks', async () => {
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])

      beforeAll(() => void calls.push([ 'hook:exec', 'beforeAll' ]))
      beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach' ]))
      afterEach(() => void calls.push([ 'hook:exec', 'afterEach' ]))
      afterAll(() => void calls.push([ 'hook:exec', 'afterAll' ]))

      it('spec 1', () => void calls.push([ 'spec:exec', 'spec 1' ]))
      it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
    })

    const execution = runSuite(suite)

    setupListeners(execution, calls)

    // no calls on suite/execution creation
    expect(calls).toEqual([])

    // only 'setup' on suite setup
    await suite.setup()
    expect(calls as any).toEqual([ [ 'suite:exec', 'suite 0' ] ])

    // all calls 'setup' on suite execution (setup is run only once!)
    const result = await execution.result
    expect(calls as any).toEqual([
      [ 'suite:exec', 'suite 0' ],
      [ 'suite:start', 'suite 0' ],
      [ 'hook:start', 'beforeAll' ],
      [ 'hook:exec', 'beforeAll' ],
      [ 'hook:pass', 'beforeAll', expect.toBeA('number') ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'spec:exec', 'spec 1' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach' ],
      [ 'hook:pass', 'afterEach', expect.toBeA('number') ],
      [ 'spec:pass', 'spec 1', expect.toBeA('number') ],
      [ 'spec:start', 'spec 2' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'spec:exec', 'spec 2' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach' ],
      [ 'hook:pass', 'afterEach', expect.toBeA('number') ],
      [ 'spec:pass', 'spec 2', expect.toBeA('number') ],
      [ 'hook:start', 'afterAll' ],
      [ 'hook:exec', 'afterAll' ],
      [ 'hook:pass', 'afterAll', expect.toBeA('number') ],
      [ 'suite:done', 'suite 0', expect.toBeA('number') ],
    ])

    expect(result).toEqual({
      time: expect.toBeA('number'),
      passed: 2,
      failed: 0,
      skipped: 0,
      failures: [],
    })
  })

  /* ======================================================================== */

  it('should inherit "beforeEach" and "afterEach" hooks from parent suites', async () => {
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach 0' ]))
      afterEach(() => void calls.push([ 'hook:exec', 'afterEach 0' ]))
      it('spec 0', () => void calls.push([ 'spec:exec', 'spec 0' ]))

      describe('suite 1', () => {
        beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach 1' ]))
        afterEach(() => void calls.push([ 'hook:exec', 'afterEach 1' ]))
        it('spec 1', () => void calls.push([ 'spec:exec', 'spec 1' ]))

        describe('suite 2', () => {
          beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach 2' ]))
          afterEach(() => void calls.push([ 'hook:exec', 'afterEach 2' ]))
          it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
        })
      })
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result

    expect(calls as any).toEqual([
      // root suite, execute:
      // "beforeEach 0"
      // -> spec
      // "afterEach 0"
      [ 'suite:start', 'suite 0' ],
      [ 'spec:start', 'spec 0' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach 0' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'spec:exec', 'spec 0' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach 0' ],
      [ 'hook:pass', 'afterEach', expect.toBeA('number') ],
      [ 'spec:pass', 'spec 0', expect.toBeA('number') ],

      // child suite, execute:
      // "beforeEach 0"
      // "beforeEach 1"
      // -> spec
      // "afterEach 1"
      // "afterEach 0"
      [ 'suite:start', 'suite 1' ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach 0' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach 1' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'spec:exec', 'spec 1' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach 1' ],
      [ 'hook:pass', 'afterEach', expect.toBeA('number') ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach 0' ],
      [ 'hook:pass', 'afterEach', expect.toBeA('number') ],
      [ 'spec:pass', 'spec 1', expect.toBeA('number') ],

      // sub-child suite, execute:
      // "beforeEach 0"
      // "beforeEach 1"
      // "beforeEach 2"
      // -> spec
      // "afterEach 2"
      // "afterEach 1"
      // "afterEach 0"
      [ 'suite:start', 'suite 2' ],
      [ 'spec:start', 'spec 2' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach 0' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach 1' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach 2' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'spec:exec', 'spec 2' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach 2' ],
      [ 'hook:pass', 'afterEach', expect.toBeA('number') ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach 1' ],
      [ 'hook:pass', 'afterEach', expect.toBeA('number') ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach 0' ],
      [ 'hook:pass', 'afterEach', expect.toBeA('number') ],
      [ 'spec:pass', 'spec 2', expect.toBeA('number') ],

      [ 'suite:done', 'suite 2', expect.toBeA('number') ],
      [ 'suite:done', 'suite 1', expect.toBeA('number') ],
      [ 'suite:done', 'suite 0', expect.toBeA('number') ],
    ])

    expect(result as any).toEqual({
      time: expect.toBeA('number'),
      passed: 3,
      failed: 0,
      skipped: 0,
      failures: [],
    })
  })

  /* ======================================================================== */

  it('should should skip a suite when a "beforeAll" hook fails', async () => {
    const error = new Error('Fail now!')
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])

      beforeAll(() => {
        throw error
      })
      beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach' ]))
      afterEach(() => void calls.push([ 'hook:exec', 'afterEach' ]))
      afterAll(() => void calls.push([ 'hook:exec', 'afterAll' ]))

      it('spec 1', () => void calls.push([ 'spec:exec', 'spec 1' ]))
      it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
    })

    const hook = expect.toBeInstanceOf(Hook).toInclude({
      parent: suite,
      name: 'beforeAll',
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    expect(calls as any).toEqual([
      [ 'suite:exec', 'suite 0' ],
      [ 'suite:start', 'suite 0' ],
      [ 'hook:start', 'beforeAll' ],
      [ 'hook:fail', 'beforeAll', expect.toBeA('number'), { number: 1, source: hook, type: 'hook', error } ],
      [ 'spec:start', 'spec 1' ],
      [ 'spec:skip', 'spec 1', expect.toBeA('number') ],
      [ 'spec:start', 'spec 2' ],
      [ 'spec:skip', 'spec 2', expect.toBeA('number') ],
      [ 'suite:done', 'suite 0', expect.toBeA('number') ],
    ])

    expect(result as any).toEqual({
      time: expect.toBeA('number'),
      passed: 0,
      failed: 0,
      skipped: 2,
      failures: [ { number: 1, source: hook, type: 'hook', error } ],
    })
  })

  /* ======================================================================== */

  it('should should pass a suite when a "afterAll" hook fails', async () => {
    const error = new Error('Fail now!')
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])

      beforeAll(() => void calls.push([ 'hook:exec', 'beforeAll' ]))
      beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach' ]))
      afterEach(() => void calls.push([ 'hook:exec', 'afterEach' ]))
      afterAll(() => {
        throw error
      })

      it('spec 1', () => void calls.push([ 'spec:exec', 'spec 1' ]))
      it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
    })

    const hook = expect.toBeInstanceOf(Hook).toInclude({
      parent: suite,
      name: 'afterAll',
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    expect(calls as any).toEqual([
      [ 'suite:exec', 'suite 0' ],
      [ 'suite:start', 'suite 0' ],
      [ 'hook:start', 'beforeAll' ],
      [ 'hook:exec', 'beforeAll' ],
      [ 'hook:pass', 'beforeAll', expect.toBeA('number') ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'spec:exec', 'spec 1' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach' ],
      [ 'hook:pass', 'afterEach', expect.toBeA('number') ],
      [ 'spec:pass', 'spec 1', expect.toBeA('number') ],
      [ 'spec:start', 'spec 2' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'spec:exec', 'spec 2' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach' ],
      [ 'hook:pass', 'afterEach', expect.toBeA('number') ],
      [ 'spec:pass', 'spec 2', expect.toBeA('number') ],
      [ 'hook:start', 'afterAll' ],
      [ 'hook:fail', 'afterAll', expect.toBeA('number'), { number: 1, source: hook, type: 'hook', error } ],
      [ 'suite:done', 'suite 0', expect.toBeA('number') ],
    ])

    expect(result as any).toEqual({
      time: expect.toBeA('number'),
      passed: 2,
      failed: 0,
      skipped: 0,
      failures: [ { number: 1, source: hook, type: 'hook', error } ],
    })
  })

  /* ======================================================================== */

  it('should should skip a spec when a "beforeEach" hook fails', async () => {
    const error = new Error('Fail now!')
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])

      beforeAll(() => void calls.push([ 'hook:exec', 'beforeAll' ]))
      beforeEach(() => {
        throw error
      })
      afterEach(() => void calls.push([ 'hook:exec', 'afterEach' ]))
      afterAll(() => void calls.push([ 'hook:exec', 'afterAll' ]))

      it('spec 1', () => void calls.push([ 'spec:exec', 'spec 1' ]))
      it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
    })

    const hook1 = expect.toBeInstanceOf(Hook).toInclude({
      name: 'beforeEach',
      parent: expect.toBeInstanceOf(Spec).toInclude({
        name: 'spec 1',
        parent: suite,
      }),
    })

    const hook2 = expect.toBeInstanceOf(Hook).toInclude({
      name: 'beforeEach',
      parent: expect.toBeInstanceOf(Spec).toInclude({
        name: 'spec 2',
        parent: suite,
      }),
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    expect(calls as any).toEqual([
      [ 'suite:exec', 'suite 0' ],
      [ 'suite:start', 'suite 0' ],
      [ 'hook:start', 'beforeAll' ],
      [ 'hook:exec', 'beforeAll' ],
      [ 'hook:pass', 'beforeAll', expect.toBeA('number') ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:fail', 'beforeEach', expect.toBeA('number'), { number: 1, source: hook1, type: 'hook', error } ],
      [ 'spec:skip', 'spec 1', expect.toBeA('number') ],
      [ 'spec:start', 'spec 2' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:fail', 'beforeEach', expect.toBeA('number'), { number: 2, source: hook2, type: 'hook', error } ],
      [ 'spec:skip', 'spec 2', expect.toBeA('number') ],
      [ 'hook:start', 'afterAll' ],
      [ 'hook:exec', 'afterAll' ],
      [ 'hook:pass', 'afterAll', expect.toBeA('number') ],
      [ 'suite:done', 'suite 0', expect.toBeA('number') ],
    ])

    expect(result as any).toEqual({
      time: expect.toBeA('number'),
      passed: 0,
      failed: 0,
      skipped: 2,
      failures: [
        { number: 1, source: hook1, type: 'hook', error },
        { number: 2, source: hook2, type: 'hook', error },
      ],
    })
  })

  /* ======================================================================== */

  it('should should pass a spec when a "afterEach" hook fails', async () => {
    const error = new Error('Fail now!')
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])

      beforeAll(() => void calls.push([ 'hook:exec', 'beforeAll' ]))
      beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach' ]))
      afterEach(() => {
        throw error
      })
      afterAll(() => void calls.push([ 'hook:exec', 'afterAll' ]))

      it('spec 1', () => void calls.push([ 'spec:exec', 'spec 1' ]))
      it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
    })

    const hook1 = expect.toBeInstanceOf(Hook).toInclude({
      name: 'afterEach',
      parent: expect.toBeInstanceOf(Spec).toInclude({
        name: 'spec 1',
        parent: suite,
      }),
    })

    const hook2 = expect.toBeInstanceOf(Hook).toInclude({
      name: 'afterEach',
      parent: expect.toBeInstanceOf(Spec).toInclude({
        name: 'spec 2',
        parent: suite,
      }),
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    // all calls 'setup' on suite execution (setup is run only once!)
    const result = await execution.result
    expect(calls as any).toEqual([
      [ 'suite:exec', 'suite 0' ],
      [ 'suite:start', 'suite 0' ],
      [ 'hook:start', 'beforeAll' ],
      [ 'hook:exec', 'beforeAll' ],
      [ 'hook:pass', 'beforeAll', expect.toBeA('number') ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'spec:exec', 'spec 1' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:fail', 'afterEach', expect.toBeA('number'), { number: 1, source: hook1, type: 'hook', error } ],
      [ 'spec:pass', 'spec 1', expect.toBeA('number') ],
      [ 'spec:start', 'spec 2' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'spec:exec', 'spec 2' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:fail', 'afterEach', expect.toBeA('number'), { number: 2, source: hook2, type: 'hook', error } ],
      [ 'spec:pass', 'spec 2', expect.toBeA('number') ],
      [ 'hook:start', 'afterAll' ],
      [ 'hook:exec', 'afterAll' ],
      [ 'hook:pass', 'afterAll', expect.toBeA('number') ],
      [ 'suite:done', 'suite 0', expect.toBeA('number') ],
    ])

    expect(result as any).toEqual({
      time: expect.toBeA('number'),
      passed: 2,
      failed: 0,
      skipped: 0,
      failures: [
        { number: 1, source: hook1, type: 'hook', error },
        { number: 2, source: hook2, type: 'hook', error },
      ],
    })
  })

  /* ======================================================================== */

  it('should report a failure when a spec fails', async () => {
    const error = new Error('Fail now!')
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])

      beforeAll(() => void calls.push([ 'hook:exec', 'beforeAll' ]))
      beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach' ]))
      afterEach(() => void calls.push([ 'hook:exec', 'afterEach' ]))
      afterAll(() => void calls.push([ 'hook:exec', 'afterAll' ]))

      it('spec 1', () => {
        throw error
      })
      it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
    })

    const spec = expect.toBeInstanceOf(Spec).toInclude({
      name: 'spec 1',
      parent: suite,
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    expect(calls as any).toEqual([
      [ 'suite:exec', 'suite 0' ],
      [ 'suite:start', 'suite 0' ],
      [ 'hook:start', 'beforeAll' ],
      [ 'hook:exec', 'beforeAll' ],
      [ 'hook:pass', 'beforeAll', expect.toBeA('number') ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach' ],
      [ 'hook:pass', 'afterEach', expect.toBeA('number') ],
      [ 'spec:fail', 'spec 1', expect.toBeA('number'), { number: 1, source: spec, type: 'spec', error } ], // reported _after_ hooks
      [ 'spec:start', 'spec 2' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'spec:exec', 'spec 2' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach' ],
      [ 'hook:pass', 'afterEach', expect.toBeA('number') ],
      [ 'spec:pass', 'spec 2', expect.toBeA('number') ],
      [ 'hook:start', 'afterAll' ],
      [ 'hook:exec', 'afterAll' ],
      [ 'hook:pass', 'afterAll', expect.toBeA('number') ],
      [ 'suite:done', 'suite 0', expect.toBeA('number') ],
    ])

    expect(result as any).toEqual({
      time: expect.toBeA('number'),
      passed: 1,
      failed: 1,
      skipped: 0,
      failures: [ { number: 1, source: spec, type: 'spec', error } ],
    })
  })

  /* ======================================================================== */

  it('should report failures when a spec and after hooks fail', async () => {
    const errorSpec = new Error('Fail spec!')
    const errorAfterEach = new Error('Fail after each!')
    const errorAfterAll = new Error('Fail after all!')
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])

      beforeAll(() => void calls.push([ 'hook:exec', 'beforeAll' ]))
      beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach' ]))
      afterEach(() => {
        throw errorAfterEach
      })
      afterAll(() => {
        throw errorAfterAll
      })
      it('spec 1', () => {
        throw errorSpec
      })
      it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
    })

    const spec = expect.toBeInstanceOf(Spec).toInclude({
      name: 'spec 1',
      parent: suite,
    })

    const hook = expect.toBeInstanceOf(Hook).toInclude({
      name: 'afterAll',
      parent: suite,
    })

    const hook1 = expect.toBeInstanceOf(Hook).toInclude({
      name: 'afterEach',
      parent: expect.toBeInstanceOf(Spec).toInclude({
        name: 'spec 1',
        parent: suite,
      }),
    })

    const hook2 = expect.toBeInstanceOf(Hook).toInclude({
      name: 'afterEach',
      parent: expect.toBeInstanceOf(Spec).toInclude({
        name: 'spec 2',
        parent: suite,
      }),
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    expect(calls as any).toEqual([
      [ 'suite:exec', 'suite 0' ],
      [ 'suite:start', 'suite 0' ],
      [ 'hook:start', 'beforeAll' ],
      [ 'hook:exec', 'beforeAll' ],
      [ 'hook:pass', 'beforeAll', expect.toBeA('number') ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'hook:start', 'afterEach' ],
      // remember, the "spec:fail" event is emitted _after_ hooks, so here numbers are inverted!
      [ 'hook:fail', 'afterEach', expect.toBeA('number'), { number: 2, source: hook1, type: 'hook', error: errorAfterEach } ],
      [ 'spec:fail', 'spec 1', expect.toBeA('number'), { number: 1, source: spec, type: 'spec', error: errorSpec } ],
      [ 'spec:start', 'spec 2' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'spec:exec', 'spec 2' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:fail', 'afterEach', expect.toBeA('number'), { number: 3, source: hook2, type: 'hook', error: errorAfterEach } ],
      [ 'spec:pass', 'spec 2', expect.toBeA('number') ],
      [ 'hook:start', 'afterAll' ],
      [ 'hook:fail', 'afterAll', expect.toBeA('number'), { number: 4, source: hook, type: 'hook', error: errorAfterAll } ],
      [ 'suite:done', 'suite 0', expect.toBeA('number') ],
    ])

    expect(result as any).toEqual({
      time: expect.toBeA('number'),
      passed: 1,
      failed: 1,
      skipped: 0,
      failures: [
        { number: 1, source: spec, type: 'spec', error: errorSpec }, // spec fails first, but emitted later
        { number: 2, source: hook1, type: 'hook', error: errorAfterEach }, // hooks fails later, but emitted first
        { number: 3, source: hook2, type: 'hook', error: errorAfterEach },
        { number: 4, source: hook, type: 'hook', error: errorAfterAll },
      ],
    })
  })

  /* ======================================================================== */

  it('should skip children marked as skipped', async () => {
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])

      beforeAll(() => void calls.push([ 'hook:exec', 'beforeAll' ]))
      beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach' ]))
      afterEach(() => void calls.push([ 'hook:exec', 'afterEach' ]))
      afterAll(() => void calls.push([ 'hook:exec', 'afterAll' ]))

      beforeAll.skip(() => void calls.push([ 'hook:exec', 'skip.beforeAll' ]))
      beforeEach.skip(() => void calls.push([ 'hook:exec', 'skip.beforeEach' ]))
      afterEach.skip(() => void calls.push([ 'hook:exec', 'skip.afterEach' ]))
      afterAll.skip(() => void calls.push([ 'hook:exec', 'skip.afterAll' ]))

      xbeforeAll(() => void calls.push([ 'hook:exec', 'xbeforeAll' ]))
      xbeforeEach(() => void calls.push([ 'hook:exec', 'xbeforeEach' ]))
      xafterEach(() => void calls.push([ 'hook:exec', 'xafterEach' ]))
      xafterAll(() => void calls.push([ 'hook:exec', 'xafterAll' ]))

      it('spec 1', () => void calls.push([ 'spec:exec', 'spec 1' ]))
      it.skip('spec 2', () => void calls.push([ 'spec:exec', 'skip spec 2' ]))
      xit('spec 3', () => void calls.push([ 'spec:exec', 'xit spec 2' ]))

      xdescribe('suite 1', () => {
        calls.push([ 'suite:exec', 'suite 1' ])

        it('spec 4', () => void calls.push([ 'spec:exec', 'spec 4' ]))
      })
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    expect(calls).toEqual([
      [ 'suite:exec', 'suite 0' ],
      [ 'suite:exec', 'suite 1' ],
      [ 'suite:start', 'suite 0' ],
      [ 'hook:start', 'beforeAll' ],
      [ 'hook:exec', 'beforeAll' ],
      [ 'hook:pass', 'beforeAll', expect.toBeA('number') ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', expect.toBeA('number') ],
      [ 'spec:exec', 'spec 1' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach' ],
      [ 'hook:pass', 'afterEach', expect.toBeA('number') ],
      [ 'spec:pass', 'spec 1', expect.toBeA('number') ],
      [ 'spec:start', 'spec 2' ],
      [ 'spec:skip', 'spec 2', expect.toBeA('number') ],
      [ 'spec:start', 'spec 3' ],
      [ 'spec:skip', 'spec 3', expect.toBeA('number') ],
      [ 'suite:start', 'suite 1' ],
      [ 'spec:start', 'spec 4' ],
      [ 'spec:skip', 'spec 4', expect.toBeA('number') ],
      [ 'suite:done', 'suite 1', expect.toBeA('number') ],
      [ 'hook:start', 'afterAll' ],
      [ 'hook:exec', 'afterAll' ],
      [ 'hook:pass', 'afterAll', expect.toBeA('number') ],
      [ 'suite:done', 'suite 0', expect.toBeA('number') ],
    ])

    expect(result).toEqual({
      time: expect.toBeA('number'),
      passed: 1,
      failed: 0,
      skipped: 3,
      failures: [],
    })
  })

  /* ======================================================================== */

  it('should skip empty suites', async () => {
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])
      // xit('spec 1', () => void calls.push([ 'spec:exec', 'xit spec 1' ]))
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    expect(calls).toEqual([
      [ 'suite:exec', 'suite 0' ],
      [ 'suite:start', 'suite 0' ],
      [ 'suite:done', 'suite 0', expect.toBeA('number') ],
    ])

    expect(result).toEqual({
      time: expect.toBeA('number'),
      passed: 0,
      failed: 0,
      skipped: 0,
      failures: [],
    })
  })

  /* ======================================================================== */

  it('should skip suites where all children are skipped', async () => {
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])
      xit('spec 1', () => void calls.push([ 'spec:exec', 'xit spec 1' ]))
      describe('suite 1', () => {
        xit('spec 2', () => void calls.push([ 'spec:exec', 'xit spec 2' ]))
      })
      xit('spec 3', () => void calls.push([ 'spec:exec', 'xit spec 3' ]))
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    expect(calls).toEqual([
      [ 'suite:exec', 'suite 0' ],
      [ 'suite:start', 'suite 0' ],
      [ 'spec:start', 'spec 1' ],
      [ 'spec:skip', 'spec 1', expect.toBeA('number') ],
      [ 'suite:start', 'suite 1' ],
      [ 'spec:start', 'spec 2' ],
      [ 'spec:skip', 'spec 2', expect.toBeA('number') ],
      [ 'suite:done', 'suite 1', expect.toBeA('number') ],
      [ 'spec:start', 'spec 3' ],
      [ 'spec:skip', 'spec 3', expect.toBeA('number') ],
      [ 'suite:done', 'suite 0', expect.toBeA('number') ],
    ])

    expect(result).toEqual({
      time: expect.toBeA('number'),
      passed: 0,
      failed: 0,
      skipped: 3,
      failures: [],
    })
  })

  /* ======================================================================== */

  it('should focus only on certain specs and suites', async () => {
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      fit('spec 1', () => void calls.push([ 'spec:exec', 'fit spec 1' ]))
      it.only('spec 2', () => void calls.push([ 'spec:exec', 'only spec 2' ]))
      it('spec 3', () => void calls.push([ 'spec:exec', 'it spec 3' ]))

      describe('suite 1', () => {
        it('spec 4', () => void calls.push([ 'spec:exec', 'it spec 4' ]))
        it('spec 5', () => void calls.push([ 'spec:exec', 'it spec 5' ]))
      })

      fdescribe('suite 2', () => {
        it('spec 6', () => void calls.push([ 'spec:exec', 'it spec 6' ]))
        xit('spec 7', () => void calls.push([ 'spec:exec', 'xit spec 7' ]))
      })

      describe.only('suite 3', () => {
        it('spec 8', () => void calls.push([ 'spec:exec', 'it spec 8' ]))
        it.skip('spec 9', () => void calls.push([ 'spec:exec', 'skip spec 9' ]))
      })

      describe('suite 4', () => {
        it('spec 10', () => void calls.push([ 'spec:exec', 'it spec 10' ]))
        it.only('spec 11', () => void calls.push([ 'spec:exec', 'only spec 11' ]))
        fit('spec 12', () => void calls.push([ 'spec:exec', 'fit spec 12' ]))
      })
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    expect(calls).toEqual([
      [ 'suite:start', 'suite 0' ],

      [ 'spec:start', 'spec 1' ],
      [ 'spec:exec', 'fit spec 1' ],
      [ 'spec:pass', 'spec 1', expect.toBeA('number') ],

      [ 'spec:start', 'spec 2' ],
      [ 'spec:exec', 'only spec 2' ],
      [ 'spec:pass', 'spec 2', expect.toBeA('number') ],

      [ 'spec:start', 'spec 3' ],
      [ 'spec:skip', 'spec 3', expect.toBeA('number') ],

      [ 'suite:start', 'suite 1' ],
      /* */ [ 'spec:start', 'spec 4' ],
      /* */ [ 'spec:skip', 'spec 4', expect.toBeA('number') ],
      /* */ [ 'spec:start', 'spec 5' ],
      /* */ [ 'spec:skip', 'spec 5', expect.toBeA('number') ],
      [ 'suite:done', 'suite 1', expect.toBeA('number') ],

      [ 'suite:start', 'suite 2' ],
      /* */ [ 'spec:start', 'spec 6' ],
      /* */ [ 'spec:exec', 'it spec 6' ],
      /* */ [ 'spec:pass', 'spec 6', expect.toBeA('number') ],
      /* */ [ 'spec:start', 'spec 7' ],
      /* */ [ 'spec:skip', 'spec 7', expect.toBeA('number') ],
      [ 'suite:done', 'suite 2', expect.toBeA('number') ],

      [ 'suite:start', 'suite 3' ],
      /* */ [ 'spec:start', 'spec 8' ],
      /* */ [ 'spec:exec', 'it spec 8' ],
      /* */ [ 'spec:pass', 'spec 8', expect.toBeA('number') ],
      /* */ [ 'spec:start', 'spec 9' ],
      /* */ [ 'spec:skip', 'spec 9', expect.toBeA('number') ],
      [ 'suite:done', 'suite 3', expect.toBeA('number') ],

      [ 'suite:start', 'suite 4' ],
      /* */ [ 'spec:start', 'spec 10' ],
      /* */ [ 'spec:skip', 'spec 10', expect.toBeA('number') ],
      /* */ [ 'spec:start', 'spec 11' ],
      /* */ [ 'spec:exec', 'only spec 11' ],
      /* */ [ 'spec:pass', 'spec 11', expect.toBeA('number') ],
      /* */ [ 'spec:start', 'spec 12' ],
      /* */ [ 'spec:exec', 'fit spec 12' ],
      /* */ [ 'spec:pass', 'spec 12', expect.toBeA('number') ],
      [ 'suite:done', 'suite 4', expect.toBeA('number') ],

      [ 'suite:done', 'suite 0', expect.toBeA('number') ],
    ])

    expect(result).toEqual({
      time: expect.toBeA('number'),
      passed: 6,
      failed: 0,
      skipped: 6,
      failures: [],
    })
  })

  /* ======================================================================== */

  it('should convert weird failures to errors', async () => {
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      it('should fail', () => {
        // eslint-disable-next-line no-throw-literal
        throw 'fail with a string!'
      })
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    expect(calls as any).toEqual([
      [ 'suite:start', 'suite 0' ],
      [ 'spec:start', 'should fail' ],
      [ 'spec:fail', 'should fail', expect.toBeA('number'), {
        number: 1,
        type: 'spec',
        source: expect.toBeInstanceOf(Spec).toInclude({
          name: 'should fail',
          parent: suite,
        }),
        error: expect.toBeError(Error, 'fail with a string!'),
      } ],
      [ 'suite:done', 'suite 0', expect.toBeA('number') ],
    ])

    expect(result as any).toEqual({
      time: expect.toBeA('number'),
      passed: 0,
      failed: 1,
      skipped: 0,
      failures: [ {
        number: 1,
        type: 'spec',
        source: expect.toBeInstanceOf(Spec).toInclude({
          name: 'should fail',
          parent: suite,
        }),
        error: expect.toBeError(Error, 'fail with a string!'),
      } ],
    })
  })

  /* ======================================================================== */

  it('should fail when specs time out', async () => {
    const calls: any[][] = []
    const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

    const suite = new Suite(undefined, 'suite 0', () => {
      it('should timeout 1', () => sleep(10), 5)
      it('should timeout 2', async () => {
        await sleep(10)
        throw new Error('Whatever...') // post
      }, 5)
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    await sleep(15) // await for "whatever" to be added...

    expect(calls as any).toEqual([
      [ 'suite:start', 'suite 0' ],
      [ 'spec:start', 'should timeout 1' ],
      [ 'spec:fail', 'should timeout 1', expect.toBeA('number'), {
        number: 1,
        type: 'spec',
        source: expect.toBeInstanceOf(Spec).toInclude({ name: 'should timeout 1', parent: suite }),
        error: expect.toBeError(Error, 'Timeout of 5 ms reached'),
      } ],
      [ 'spec:start', 'should timeout 2' ],
      [ 'spec:fail', 'should timeout 2', expect.toBeA('number'), {
        number: 2,
        type: 'spec',
        source: expect.toBeInstanceOf(Spec).toInclude({ name: 'should timeout 2', parent: suite }),
        error: expect.toBeError(Error, 'Timeout of 5 ms reached'),
      } ],
      [ 'suite:done', 'suite 0', expect.toBeA('number') ],

      // failure raised *after* timeout!
      [ 'spec:error', 'should timeout 2', {
        number: 3,
        type: 'spec',
        source: expect.toBeInstanceOf(Spec).toInclude({ name: 'should timeout 2', parent: suite }),
        error: expect.toBeError(Error, 'Whatever...'),
      } ],
    ])

    expect(result as any).toEqual({
      time: expect.toBeA('number'),
      passed: 0,
      failed: 2,
      skipped: 0,
      failures: [ {
        number: 1,
        type: 'spec',
        source: expect.toBeInstanceOf(Spec).toInclude({
          name: 'should timeout 1',
          parent: suite,
        }),
        error: expect.toBeError(Error, 'Timeout of 5 ms reached'),
      }, {
        number: 2,
        type: 'spec',
        source: expect.toBeInstanceOf(Spec).toInclude({
          name: 'should timeout 2',
          parent: suite,
        }),
        error: expect.toBeError(Error, 'Timeout of 5 ms reached'),
      }, {
        number: 3,
        type: 'spec',
        source: expect.toBeInstanceOf(Spec).toInclude({
          name: 'should timeout 2',
          parent: suite,
        }),
        error: expect.toBeError(Error, 'Whatever...'),
      } ],
    })
  })

  /* ======================================================================== */

  it('should fail when a suite setup fails', async () => {
    const suite = new Suite(undefined, 'suite 0', () => {
      throw new Error('Hello, world!')
    })

    await expect(runSuite(suite).result)
        .toBeRejectedWithError(Error, 'Hello, world!')
  })

  /* ======================================================================== */

  it('should fail when a suite setup times out', async () => {
    const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

    const suite = new Suite(undefined, 'suite 0', async () => {
      await sleep(10)
    }, 5)

    await expect(runSuite(suite).result)
        .toBeRejectedWithError(Error, 'Timeout of 5 ms reached')
  })

  /* ======================================================================== */

  it('should skip within hooks and specs', async () => {
    const calls: any[][] = []
    const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

    const suite = new Suite(undefined, 'suite 0', async () => {
      beforeEach(() => skip())
      it('should skip this', () => skip())
      it('should fail this', () => {
        skip()
        throw new SyntaxError('Whatever...')
      })
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    await sleep(10)

    expect(calls as any).toEqual([
      [ 'suite:start', 'suite 0' ],

      [ 'spec:start', 'should skip this' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:skip', 'beforeEach', expect.toBeA('number') ],
      [ 'spec:skip', 'should skip this', expect.toBeA('number') ],

      [ 'spec:start', 'should fail this' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:skip', 'beforeEach', expect.toBeA('number') ],
      [ 'spec:fail', 'should fail this', expect.toBeA('number'), {
        number: 1,
        type: 'spec',
        source: expect.toBeInstanceOf(Spec).toInclude({
          name: 'should fail this',
          parent: suite,
        }),
        error: expect.toBeError(SyntaxError, 'Whatever...'),
      } ],

      [ 'suite:done', 'suite 0', expect.toBeA('number') ],
    ])

    expect(result as any).toEqual({
      time: expect.toBeA('number'),
      passed: 0,
      failed: 1,
      skipped: 1,
      failures: [ {
        number: 1,
        type: 'spec',
        source: expect.toBeInstanceOf(Spec).toInclude({
          name: 'should fail this',
          parent: suite,
        }),
        error: expect.toBeError(SyntaxError, 'Whatever...'),
      } ],
    })
  })

  /* ======================================================================== */

  it('should register and unregister listeners', async () => {
    const calls: string[] = []

    const listener1 = (spec: Spec): void => void calls.push(`L1:${spec.name}`)
    const listener2 = (spec: Spec): void => void calls.push(`L2:${spec.name}`)

    const suite = new Suite(undefined, 'suite 0', async () => {
      it('one', () => {})
      it('two', () => void execution.off('spec:start', listener2))
      it('three', () => skip())
    })

    const execution = runSuite(suite)

    execution.once('spec:start', listener1)
    execution.on('spec:start', listener2) // off by spec "two"

    await execution.result
    expect(calls).toEqual([ 'L1:one', 'L2:one', 'L2:two' ])
  })
})
