import { Suite, skip } from '../src/execution/executable'
import { runSuite, type Execution } from '../src/execution/executor'
import * as setup from '../src/execution/setup'

import type { Spec, Hook } from '../src/execution/executable'

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

      setup.beforeAll(() => void calls.push([ 'hook:exec', 'beforeAll' ]))
      setup.beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach' ]))
      setup.afterEach(() => void calls.push([ 'hook:exec', 'afterEach' ]))
      setup.afterAll(() => void calls.push([ 'hook:exec', 'afterAll' ]))

      setup.it('spec 1', () => void calls.push([ 'spec:exec', 'spec 1' ]))
      setup.it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
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
      [ 'hook:pass', 'beforeAll', jasmine.any(Number) ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', jasmine.any(Number) ],
      [ 'spec:exec', 'spec 1' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach' ],
      [ 'hook:pass', 'afterEach', jasmine.any(Number) ],
      [ 'spec:pass', 'spec 1', jasmine.any(Number) ],
      [ 'spec:start', 'spec 2' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', jasmine.any(Number) ],
      [ 'spec:exec', 'spec 2' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach' ],
      [ 'hook:pass', 'afterEach', jasmine.any(Number) ],
      [ 'spec:pass', 'spec 2', jasmine.any(Number) ],
      [ 'hook:start', 'afterAll' ],
      [ 'hook:exec', 'afterAll' ],
      [ 'hook:pass', 'afterAll', jasmine.any(Number) ],
      [ 'suite:done', 'suite 0', jasmine.any(Number) ],
    ])

    expect(result).toEqual({
      time: jasmine.any(Number),
      specs: 2,
      passed: 2,
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

      setup.beforeAll(() => {
        throw error
      })
      setup.beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach' ]))
      setup.afterEach(() => void calls.push([ 'hook:exec', 'afterEach' ]))
      setup.afterAll(() => void calls.push([ 'hook:exec', 'afterAll' ]))

      setup.it('spec 1', () => void calls.push([ 'spec:exec', 'spec 1' ]))
      setup.it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
    })

    const hook = jasmine.objectContaining({
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
      [ 'hook:fail', 'beforeAll', jasmine.any(Number), [ { hook, error } ] ],
      [ 'spec:start', 'spec 1' ],
      [ 'spec:skip', 'spec 1', jasmine.any(Number) ],
      [ 'spec:start', 'spec 2' ],
      [ 'spec:skip', 'spec 2', jasmine.any(Number) ],
      [ 'suite:done', 'suite 0', jasmine.any(Number) ],
    ])

    expect(result as any).toEqual({
      time: jasmine.any(Number),
      specs: 2,
      passed: 0,
      failed: 0,
      skipped: 2,
      failures: [ { hook, error } ],
    })
  })

  /* ======================================================================== */

  it('should should pass a suite when a "afterAll" hook fails', async () => {
    const error = new Error('Fail now!')
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])

      setup.beforeAll(() => void calls.push([ 'hook:exec', 'beforeAll' ]))
      setup.beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach' ]))
      setup.afterEach(() => void calls.push([ 'hook:exec', 'afterEach' ]))
      setup.afterAll(() => {
        throw error
      })

      setup.it('spec 1', () => void calls.push([ 'spec:exec', 'spec 1' ]))
      setup.it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
    })

    const hook = jasmine.objectContaining({
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
      [ 'hook:pass', 'beforeAll', jasmine.any(Number) ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', jasmine.any(Number) ],
      [ 'spec:exec', 'spec 1' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach' ],
      [ 'hook:pass', 'afterEach', jasmine.any(Number) ],
      [ 'spec:pass', 'spec 1', jasmine.any(Number) ],
      [ 'spec:start', 'spec 2' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', jasmine.any(Number) ],
      [ 'spec:exec', 'spec 2' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach' ],
      [ 'hook:pass', 'afterEach', jasmine.any(Number) ],
      [ 'spec:pass', 'spec 2', jasmine.any(Number) ],
      [ 'hook:start', 'afterAll' ],
      [ 'hook:fail', 'afterAll', jasmine.any(Number), [ { hook, error } ] ],
      [ 'suite:done', 'suite 0', jasmine.any(Number) ],
    ])

    expect(result as any).toEqual({
      time: jasmine.any(Number),
      specs: 2,
      passed: 2,
      failed: 0,
      skipped: 0,
      failures: [ { hook, error } ],
    })
  })

  /* ======================================================================== */

  it('should should skip a spec when a "beforeEach" hook fails', async () => {
    const error = new Error('Fail now!')
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])

      setup.beforeAll(() => void calls.push([ 'hook:exec', 'beforeAll' ]))
      setup.beforeEach(() => {
        throw error
      })
      setup.afterEach(() => void calls.push([ 'hook:exec', 'afterEach' ]))
      setup.afterAll(() => void calls.push([ 'hook:exec', 'afterAll' ]))

      setup.it('spec 1', () => void calls.push([ 'spec:exec', 'spec 1' ]))
      setup.it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
    })

    const hook1 = jasmine.objectContaining({
      name: 'beforeEach',
      parent: jasmine.objectContaining({
        name: 'spec 1',
        parent: suite,
      }),
    })

    const hook2 = jasmine.objectContaining({
      name: 'beforeEach',
      parent: jasmine.objectContaining({
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
      [ 'hook:pass', 'beforeAll', jasmine.any(Number) ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:fail', 'beforeEach', jasmine.any(Number), [ { hook: hook1, error } ] ],
      [ 'spec:skip', 'spec 1', jasmine.any(Number) ],
      [ 'spec:start', 'spec 2' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:fail', 'beforeEach', jasmine.any(Number), [ { hook: hook2, error } ] ],
      [ 'spec:skip', 'spec 2', jasmine.any(Number) ],
      [ 'hook:start', 'afterAll' ],
      [ 'hook:exec', 'afterAll' ],
      [ 'hook:pass', 'afterAll', jasmine.any(Number) ],
      [ 'suite:done', 'suite 0', jasmine.any(Number) ],
    ])

    expect(result as any).toEqual({
      time: jasmine.any(Number),
      specs: 2,
      passed: 0,
      failed: 0,
      skipped: 2,
      failures: [
        { hook: hook1, error },
        { hook: hook2, error },
      ],
    })
  })

  /* ======================================================================== */

  it('should should pass a spec when a "afterEach" hook fails', async () => {
    const error = new Error('Fail now!')
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])

      setup.beforeAll(() => void calls.push([ 'hook:exec', 'beforeAll' ]))
      setup.beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach' ]))
      setup.afterEach(() => {
        throw error
      })
      setup.afterAll(() => void calls.push([ 'hook:exec', 'afterAll' ]))

      setup.it('spec 1', () => void calls.push([ 'spec:exec', 'spec 1' ]))
      setup.it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
    })

    const hook1 = jasmine.objectContaining({
      name: 'afterEach',
      parent: jasmine.objectContaining({
        name: 'spec 1',
        parent: suite,
      }),
    })

    const hook2 = jasmine.objectContaining({
      name: 'afterEach',
      parent: jasmine.objectContaining({
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
      [ 'hook:pass', 'beforeAll', jasmine.any(Number) ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', jasmine.any(Number) ],
      [ 'spec:exec', 'spec 1' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:fail', 'afterEach', jasmine.any(Number), [ { hook: hook1, error } ] ],
      [ 'spec:pass', 'spec 1', jasmine.any(Number) ],
      [ 'spec:start', 'spec 2' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', jasmine.any(Number) ],
      [ 'spec:exec', 'spec 2' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:fail', 'afterEach', jasmine.any(Number), [ { hook: hook2, error } ] ],
      [ 'spec:pass', 'spec 2', jasmine.any(Number) ],
      [ 'hook:start', 'afterAll' ],
      [ 'hook:exec', 'afterAll' ],
      [ 'hook:pass', 'afterAll', jasmine.any(Number) ],
      [ 'suite:done', 'suite 0', jasmine.any(Number) ],
    ])

    expect(result as any).toEqual({
      time: jasmine.any(Number),
      specs: 2,
      passed: 2,
      failed: 0,
      skipped: 0,
      failures: [
        { hook: hook1, error },
        { hook: hook2, error },
      ],
    })
  })

  /* ======================================================================== */

  it('should report a failure when a spec fails', async () => {
    const error = new Error('Fail now!')
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])

      setup.beforeAll(() => void calls.push([ 'hook:exec', 'beforeAll' ]))
      setup.beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach' ]))
      setup.afterEach(() => void calls.push([ 'hook:exec', 'afterEach' ]))
      setup.afterAll(() => void calls.push([ 'hook:exec', 'afterAll' ]))

      setup.it('spec 1', () => {
        throw error
      })
      setup.it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
    })

    const spec = jasmine.objectContaining({
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
      [ 'hook:pass', 'beforeAll', jasmine.any(Number) ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', jasmine.any(Number) ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach' ],
      [ 'hook:pass', 'afterEach', jasmine.any(Number) ],
      [ 'spec:fail', 'spec 1', jasmine.any(Number), [ { spec, error } ] ], // reported _after_ hooks
      [ 'spec:start', 'spec 2' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', jasmine.any(Number) ],
      [ 'spec:exec', 'spec 2' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach' ],
      [ 'hook:pass', 'afterEach', jasmine.any(Number) ],
      [ 'spec:pass', 'spec 2', jasmine.any(Number) ],
      [ 'hook:start', 'afterAll' ],
      [ 'hook:exec', 'afterAll' ],
      [ 'hook:pass', 'afterAll', jasmine.any(Number) ],
      [ 'suite:done', 'suite 0', jasmine.any(Number) ],
    ])

    expect(result as any).toEqual({
      time: jasmine.any(Number),
      specs: 2,
      passed: 1,
      failed: 1,
      skipped: 0,
      failures: [ { spec, error } ],
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

      setup.beforeAll(() => void calls.push([ 'hook:exec', 'beforeAll' ]))
      setup.beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach' ]))
      setup.afterEach(() => {
        throw errorAfterEach
      })
      setup.afterAll(() => {
        throw errorAfterAll
      })
      setup.it('spec 1', () => {
        throw errorSpec
      })
      setup.it('spec 2', () => void calls.push([ 'spec:exec', 'spec 2' ]))
    })

    const spec = jasmine.objectContaining({
      name: 'spec 1',
      parent: suite,
    })

    const hook = jasmine.objectContaining({
      name: 'afterAll',
      parent: suite,
    })

    const hook1 = jasmine.objectContaining({
      name: 'afterEach',
      parent: jasmine.objectContaining({
        name: 'spec 1',
        parent: suite,
      }),
    })

    const hook2 = jasmine.objectContaining({
      name: 'afterEach',
      parent: jasmine.objectContaining({
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
      [ 'hook:pass', 'beforeAll', jasmine.any(Number) ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', jasmine.any(Number) ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:fail', 'afterEach', jasmine.any(Number), [ { hook: hook1, error: errorAfterEach } ] ],
      [ 'spec:fail', 'spec 1', jasmine.any(Number), [ { spec, error: errorSpec } ] ],
      [ 'spec:start', 'spec 2' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', jasmine.any(Number) ],
      [ 'spec:exec', 'spec 2' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:fail', 'afterEach', jasmine.any(Number), [ { hook: hook2, error: errorAfterEach } ] ],
      [ 'spec:pass', 'spec 2', jasmine.any(Number) ],
      [ 'hook:start', 'afterAll' ],
      [ 'hook:fail', 'afterAll', jasmine.any(Number), [ { hook, error: errorAfterAll } ] ],
      [ 'suite:done', 'suite 0', jasmine.any(Number) ],
    ])

    expect(result as any).toEqual({
      time: jasmine.any(Number),
      specs: 2,
      passed: 1,
      failed: 1,
      skipped: 0,
      failures: [
        { spec, error: errorSpec },
        { hook: hook1, error: errorAfterEach },
        { hook: hook2, error: errorAfterEach },
        { hook, error: errorAfterAll },
      ],
    })
  })

  /* ======================================================================== */

  it('should skip children marked as skipped', async () => {
    const calls: any[][] = []

    const suite = new Suite(undefined, 'suite 0', () => {
      calls.push([ 'suite:exec', 'suite 0' ])

      setup.beforeAll(() => void calls.push([ 'hook:exec', 'beforeAll' ]))
      setup.beforeEach(() => void calls.push([ 'hook:exec', 'beforeEach' ]))
      setup.afterEach(() => void calls.push([ 'hook:exec', 'afterEach' ]))
      setup.afterAll(() => void calls.push([ 'hook:exec', 'afterAll' ]))

      setup.beforeAll.skip(() => void calls.push([ 'hook:exec', 'skip.beforeAll' ]))
      setup.beforeEach.skip(() => void calls.push([ 'hook:exec', 'skip.beforeEach' ]))
      setup.afterEach.skip(() => void calls.push([ 'hook:exec', 'skip.afterEach' ]))
      setup.afterAll.skip(() => void calls.push([ 'hook:exec', 'skip.afterAll' ]))

      setup.xbeforeAll(() => void calls.push([ 'hook:exec', 'xbeforeAll' ]))
      setup.xbeforeEach(() => void calls.push([ 'hook:exec', 'xbeforeEach' ]))
      setup.xafterEach(() => void calls.push([ 'hook:exec', 'xafterEach' ]))
      setup.xafterAll(() => void calls.push([ 'hook:exec', 'xafterAll' ]))

      setup.it('spec 1', () => void calls.push([ 'spec:exec', 'spec 1' ]))
      setup.it.skip('spec 2', () => void calls.push([ 'spec:exec', 'skip spec 2' ]))
      setup.xit('spec 3', () => void calls.push([ 'spec:exec', 'xit spec 2' ]))

      setup.xdescribe('suite 1', () => {
        calls.push([ 'suite:exec', 'suite 1' ])

        setup.it('spec 4', () => void calls.push([ 'spec:exec', 'spec 4' ]))
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
      [ 'hook:pass', 'beforeAll', jasmine.any(Number) ],
      [ 'spec:start', 'spec 1' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:exec', 'beforeEach' ],
      [ 'hook:pass', 'beforeEach', jasmine.any(Number) ],
      [ 'spec:exec', 'spec 1' ],
      [ 'hook:start', 'afterEach' ],
      [ 'hook:exec', 'afterEach' ],
      [ 'hook:pass', 'afterEach', jasmine.any(Number) ],
      [ 'spec:pass', 'spec 1', jasmine.any(Number) ],
      [ 'spec:start', 'spec 2' ],
      [ 'spec:skip', 'spec 2', jasmine.any(Number) ],
      [ 'spec:start', 'spec 3' ],
      [ 'spec:skip', 'spec 3', jasmine.any(Number) ],
      [ 'suite:start', 'suite 1' ],
      [ 'spec:start', 'spec 4' ],
      [ 'spec:skip', 'spec 4', jasmine.any(Number) ],
      [ 'suite:done', 'suite 1', jasmine.any(Number) ],
      [ 'hook:start', 'afterAll' ],
      [ 'hook:exec', 'afterAll' ],
      [ 'hook:pass', 'afterAll', jasmine.any(Number) ],
      [ 'suite:done', 'suite 0', jasmine.any(Number) ],
    ])

    expect(result).toEqual({
      time: jasmine.any(Number),
      specs: 4,
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
      // setup.xit('spec 1', () => void calls.push([ 'spec:exec', 'xit spec 1' ]))
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    expect(calls).toEqual([
      [ 'suite:exec', 'suite 0' ],
      [ 'suite:start', 'suite 0' ],
      [ 'suite:done', 'suite 0', jasmine.any(Number) ],
    ])

    expect(result).toEqual({
      time: jasmine.any(Number),
      specs: 0,
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
      setup.xit('spec 1', () => void calls.push([ 'spec:exec', 'xit spec 1' ]))
      setup.describe('suite 1', () => {
        setup.xit('spec 2', () => void calls.push([ 'spec:exec', 'xit spec 2' ]))
      })
      setup.xit('spec 3', () => void calls.push([ 'spec:exec', 'xit spec 3' ]))
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    expect(calls).toEqual([
      [ 'suite:exec', 'suite 0' ],
      [ 'suite:start', 'suite 0' ],
      [ 'spec:start', 'spec 1' ],
      [ 'spec:skip', 'spec 1', jasmine.any(Number) ],
      [ 'suite:start', 'suite 1' ],
      [ 'spec:start', 'spec 2' ],
      [ 'spec:skip', 'spec 2', jasmine.any(Number) ],
      [ 'suite:done', 'suite 1', jasmine.any(Number) ],
      [ 'spec:start', 'spec 3' ],
      [ 'spec:skip', 'spec 3', jasmine.any(Number) ],
      [ 'suite:done', 'suite 0', jasmine.any(Number) ],
    ])

    expect(result).toEqual({
      time: jasmine.any(Number),
      specs: 3,
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
      setup.fit('spec 1', () => void calls.push([ 'spec:exec', 'fit spec 1' ]))
      setup.it.only('spec 2', () => void calls.push([ 'spec:exec', 'only spec 2' ]))
      setup.it('spec 3', () => void calls.push([ 'spec:exec', 'it spec 3' ]))

      setup.describe('suite 1', () => {
        setup.it('spec 4', () => void calls.push([ 'spec:exec', 'it spec 4' ]))
        setup.it('spec 5', () => void calls.push([ 'spec:exec', 'it spec 5' ]))
      })

      setup.fdescribe('suite 2', () => {
        setup.it('spec 6', () => void calls.push([ 'spec:exec', 'it spec 6' ]))
        setup.xit('spec 7', () => void calls.push([ 'spec:exec', 'xit spec 7' ]))
      })

      setup.describe.only('suite 3', () => {
        setup.it('spec 8', () => void calls.push([ 'spec:exec', 'it spec 8' ]))
        setup.it.skip('spec 9', () => void calls.push([ 'spec:exec', 'skip spec 9' ]))
      })

      setup.describe('suite 4', () => {
        setup.it('spec 10', () => void calls.push([ 'spec:exec', 'it spec 10' ]))
        setup.it.only('spec 11', () => void calls.push([ 'spec:exec', 'only spec 11' ]))
        setup.fit('spec 12', () => void calls.push([ 'spec:exec', 'fit spec 12' ]))
      })
    })

    const execution = runSuite(suite)
    setupListeners(execution, calls)

    const result = await execution.result
    expect(calls).toEqual([
      [ 'suite:start', 'suite 0' ],

      [ 'spec:start', 'spec 1' ],
      [ 'spec:exec', 'fit spec 1' ],
      [ 'spec:pass', 'spec 1', jasmine.any(Number) ],

      [ 'spec:start', 'spec 2' ],
      [ 'spec:exec', 'only spec 2' ],
      [ 'spec:pass', 'spec 2', jasmine.any(Number) ],

      [ 'spec:start', 'spec 3' ],
      [ 'spec:skip', 'spec 3', jasmine.any(Number) ],

      [ 'suite:start', 'suite 1' ],
      /* */ [ 'spec:start', 'spec 4' ],
      /* */ [ 'spec:skip', 'spec 4', jasmine.any(Number) ],
      /* */ [ 'spec:start', 'spec 5' ],
      /* */ [ 'spec:skip', 'spec 5', jasmine.any(Number) ],
      [ 'suite:done', 'suite 1', jasmine.any(Number) ],

      [ 'suite:start', 'suite 2' ],
      /* */ [ 'spec:start', 'spec 6' ],
      /* */ [ 'spec:exec', 'it spec 6' ],
      /* */ [ 'spec:pass', 'spec 6', jasmine.any(Number) ],
      /* */ [ 'spec:start', 'spec 7' ],
      /* */ [ 'spec:skip', 'spec 7', jasmine.any(Number) ],
      [ 'suite:done', 'suite 2', jasmine.any(Number) ],

      [ 'suite:start', 'suite 3' ],
      /* */ [ 'spec:start', 'spec 8' ],
      /* */ [ 'spec:exec', 'it spec 8' ],
      /* */ [ 'spec:pass', 'spec 8', jasmine.any(Number) ],
      /* */ [ 'spec:start', 'spec 9' ],
      /* */ [ 'spec:skip', 'spec 9', jasmine.any(Number) ],
      [ 'suite:done', 'suite 3', jasmine.any(Number) ],

      [ 'suite:start', 'suite 4' ],
      /* */ [ 'spec:start', 'spec 10' ],
      /* */ [ 'spec:skip', 'spec 10', jasmine.any(Number) ],
      /* */ [ 'spec:start', 'spec 11' ],
      /* */ [ 'spec:exec', 'only spec 11' ],
      /* */ [ 'spec:pass', 'spec 11', jasmine.any(Number) ],
      /* */ [ 'spec:start', 'spec 12' ],
      /* */ [ 'spec:exec', 'fit spec 12' ],
      /* */ [ 'spec:pass', 'spec 12', jasmine.any(Number) ],
      [ 'suite:done', 'suite 4', jasmine.any(Number) ],

      [ 'suite:done', 'suite 0', jasmine.any(Number) ],
    ])

    expect(result).toEqual({
      time: jasmine.any(Number),
      specs: 12,
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
      setup.it('should fail', () => {
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
      [ 'spec:fail', 'should fail', jasmine.any(Number), [ {
        spec: jasmine.objectContaining({
          name: 'should fail',
          parent: suite,
        }),
        error: jasmine.objectContaining({
          message: 'fail with a string!',
        }),
      } ] ],
      [ 'suite:done', 'suite 0', jasmine.any(Number) ],
    ])

    expect(result as any).toEqual({
      time: jasmine.any(Number),
      specs: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      failures: [ {
        spec: jasmine.objectContaining({
          name: 'should fail',
          parent: suite,
        }),
        error: jasmine.objectContaining({
          message: 'fail with a string!',
        }),
      } ],
    })
  })

  /* ======================================================================== */

  it('should fail when specs time out', async () => {
    const calls: any[][] = []
    const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

    const suite = new Suite(undefined, 'suite 0', () => {
      setup.it('should timeout 1', () => sleep(10), 5)
      setup.it('should timeout 2', async () => {
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
      [ 'spec:fail', 'should timeout 1', jasmine.any(Number), [ {
        spec: jasmine.objectContaining({ name: 'should timeout 1', parent: suite }),
        error: jasmine.objectContaining({ message: 'Timeout of 5 ms reached' } ),
      } ] ],
      [ 'spec:start', 'should timeout 2' ],
      [ 'spec:fail', 'should timeout 2', jasmine.any(Number), [ {
        spec: jasmine.objectContaining({ name: 'should timeout 2', parent: suite }),
        error: jasmine.objectContaining({ message: 'Timeout of 5 ms reached' } ),
      } ] ],
      [ 'suite:done', 'suite 0', jasmine.any(Number) ],

      // failure raised *after* timeout!
      [ 'spec:error', 'should timeout 2', {
        spec: jasmine.objectContaining({ name: 'should timeout 2', parent: suite }),
        error: jasmine.objectContaining({ message: 'Whatever...' } ),
      } ],
    ])

    expect(result as any).toEqual({
      time: jasmine.any(Number),
      specs: 2,
      passed: 0,
      failed: 2,
      skipped: 0,
      failures: [ {
        spec: jasmine.objectContaining({
          name: 'should timeout 1',
          parent: suite,
        }),
        error: jasmine.objectContaining({
          message: 'Timeout of 5 ms reached',
        }),
      }, {
        spec: jasmine.objectContaining({
          name: 'should timeout 2',
          parent: suite,
        }),
        error: jasmine.objectContaining({
          message: 'Timeout of 5 ms reached',
        }),
      }, {
        spec: jasmine.objectContaining({
          name: 'should timeout 2',
          parent: suite,
        }),
        error: jasmine.objectContaining({
          message: 'Whatever...',
        }),
      } ],
    })
  })

  /* ======================================================================== */

  it('should fail when a suite setup fails', async () => {
    const suite = new Suite(undefined, 'suite 0', () => {
      throw new Error('Hello, world!')
    })

    await expectAsync(runSuite(suite).result)
        .toBeRejectedWithError(Error, 'Hello, world!')
  })

  /* ======================================================================== */

  it('should fail when a suite setup times out', async () => {
    const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

    const suite = new Suite(undefined, 'suite 0', async () => {
      await sleep(10)
    }, 5)

    await expectAsync(runSuite(suite).result)
        .toBeRejectedWithError(Error, 'Timeout of 5 ms reached')
  })

  /* ======================================================================== */

  it('should skip within hooks and specs', async () => {
    const calls: any[][] = []
    const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

    const suite = new Suite(undefined, 'suite 0', async () => {
      setup.beforeEach(() => skip())
      setup.it('should skip this', () => skip())
      setup.it('should fail this', () => {
        skip()
        throw new Error('Whatever...')
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
      [ 'hook:skip', 'beforeEach', jasmine.any(Number) ],
      [ 'spec:skip', 'should skip this', jasmine.any(Number) ],

      [ 'spec:start', 'should fail this' ],
      [ 'hook:start', 'beforeEach' ],
      [ 'hook:skip', 'beforeEach', jasmine.any(Number) ],
      [ 'spec:fail', 'should fail this', jasmine.any(Number), [ {
        spec: jasmine.objectContaining({
          name: 'should fail this',
          parent: suite,
        }),
        error: jasmine.objectContaining({
          message: 'Whatever...',
        }),
      } ] ],

      [ 'suite:done', 'suite 0', jasmine.any(Number) ],
    ])

    expect(result as any).toEqual({
      time: jasmine.any(Number),
      specs: 2,
      passed: 0,
      failed: 1,
      skipped: 1,
      failures: [ {
        spec: jasmine.objectContaining({
          name: 'should fail this',
          parent: suite,
        }),
        error: jasmine.objectContaining({
          message: 'Whatever...',
        }),
      } ],
    })
  })

  /* ======================================================================== */

  it('should register and unregister listeners', async () => {
    const calls: string[] = []

    const listener1 = (spec: Spec): void => void calls.push(`L1:${spec.name}`)
    const listener2 = (spec: Spec): void => void calls.push(`L2:${spec.name}`)

    const suite = new Suite(undefined, 'suite 0', async () => {
      setup.it('one', () => {})
      setup.it('two', () => void execution.off('spec:start', listener2))
      setup.it('three', () => skip())
    })

    const execution = runSuite(suite)

    execution.once('spec:start', listener1)
    execution.on('spec:start', listener2) // off by spec "two"

    await execution.result
    expect(calls).toEqual([ 'L1:one', 'L2:one', 'L2:two' ])
  })
})

// expect('').toBe
// expect('').toBeCloseTo
// expect('').toBeDefined
// expect('').toBeFalse
// expect('').toBeFalsy
// expect('').toBeGreaterThan
// expect('').toBeGreaterThanOrEqual
// expect('').toBeInstanceOf
// expect('').toBeLessThan
// expect('').toBeLessThanOrEqual
// expect('').toBeNaN
// expect('').toBeNegativeInfinity
// expect('').toBeNull
// expect('').toBePositiveInfinity
// expect('').toBeTrue
// expect('').toBeTruthy
// expect('').toBeUndefined
// expect('').toContain // arrays
// expect('').toEqual
// expect('').toHaveSize // length
// expect('').toMatch
// expect('').toThrow
