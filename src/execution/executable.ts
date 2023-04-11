import assert from 'node:assert'
import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * A _callable_ (possibly async) function.
 *
 * When the timeout configured is reached, the passed `signal` will be aborted.
 */
export type Call = (signal: AbortSignal) => void | Promise<void>

/** Flag types for an {@link Executable} */
export type Flag = 'skip' | 'only' | undefined

/** An {@link Executor} notifying lifecycle events for {@link Executable}s */
export interface Executor {
  start(executable: Suite | Spec | Hook): {
    notify(error: Error): void,
    done(skip?: boolean): void,
  }
}

/* ========================================================================== */

/** Execute a {@link Call} invoking the {@link Done} */
function execute(
    call: Call,
    timeout: number,
    notify?: (error: Error) => void,
): Promise<Error | undefined> {
  return new Promise<Error | undefined>((resolve) => {
    let resolved = false

    /* Create the abort controller */
    const abort = new AbortController()
    const handle = setTimeout(() => {
      /* coverage ignore if */
      if (resolved) return

      const error = new Error(`Timeout of ${timeout} ms reached`)
      resolve(error)
      notify?.(error)
      resolved = true
    }, timeout).unref()

    /* Use a secondary promise to wrap the (possibly async) call */
    void Promise.resolve().then(async () => {
      try {
        await call(abort.signal)
        resolve(undefined)
        resolved = true
      } catch (cause: any) {
        const error = cause instanceof Error ? cause : new Error(String(cause))
        notify?.(error)
        resolve(error)
        resolved = true
      } finally {
        abort.abort('Spec finished')
        clearTimeout(handle)
      }
    })
  })
}

/* ========================================================================== */

const suiteStorage = new AsyncLocalStorage<Suite>()
const skipStorage = new AsyncLocalStorage<{ skipped: boolean }>()

export function getCurrentSuite(): Suite {
  const suite = suiteStorage.getStore()
  assert(suite, 'No suite found')
  return suite
}

export function skip(): void {
  const skipState = skipStorage.getStore()
  assert(skipState, 'The "skip" function can only be used in specs or hooks')
  skipState.skipped = true
}

/* ========================================================================== */

/** Our {@link Suite} implementation */
export class Suite {
  private _beforeAll: Hook[] = []
  private _beforeEach: Hook[] = []
  private _afterAll: Hook[] = []
  private _afterEach: Hook[] = []
  private _suites: Suite[] = []
  private _specs: Spec[] = []
  private _children: (Suite | Spec)[] = []
  private _setup: boolean = false

  constructor(
      public readonly parent: Suite | undefined,
      public readonly name: string,
      public readonly call: Call,
      public readonly timeout: number = 5000,
      public flag: Flag = undefined,
  ) {}

  /** Add a child {@link Suite} to this */
  addSuite(suite: Suite): void {
    assert.strictEqual(suite.parent, this, 'Suite is not a child of this')
    this._children.push(suite)
    this._suites.push(suite)
  }

  /** Add a {@link Spec} to this */
  addSpec(spec: Spec): void {
    assert.strictEqual(spec.parent, this, 'Spec is not a child of this')
    this._children.push(spec)
    this._specs.push(spec)
  }

  /** Add a _before all_ {@link Hook} to this */
  addBeforeAllHook(hook: Hook): void {
    assert.strictEqual(hook.parent, this, 'Hook is not a child of this')
    assert.strictEqual(hook.name, 'beforeAll', `Invalid before all hook name "${hook.name}"`)
    this._beforeAll.push(hook)
  }

  /** Add a _before each_ {@link Hook} to this */
  addBeforeEachHook(hook: Hook): void {
    assert.strictEqual(hook.parent, this, 'Hook is not a child of this')
    assert.strictEqual(hook.name, 'beforeEach', `Invalid before each hook name "${hook.name}"`)
    this._beforeEach.push(hook)
  }

  /** Add a _after all_ {@link Hook} to this */
  addAfterAllHook(hook: Hook): void {
    assert.strictEqual(hook.parent, this, 'Hook is not a child of this')
    assert.strictEqual(hook.name, 'afterAll', `Invalid after all hook name "${hook.name}"`)
    this._afterAll.push(hook)
  }

  /** Add a _after each_ {@link Hook} to this */
  addAfterEachHook(hook: Hook): void {
    assert.strictEqual(hook.parent, this, 'Hook is not a child of this')
    assert.strictEqual(hook.name, 'afterEach', `Invalid after each hook name "${hook.name}"`)
    this._afterEach.push(hook)
  }

  /**
   * Setup this {@link Suite} invoking its main function, then initializing all
   * children {@link Suite Suites}, and finally normalizing execution flags.
   */
  async setup(): Promise<void> {
    /* If this suite was already setup, this becomes a no-op */
    if (this._setup) return

    /* Run the setup call */
    this._setup = true
    await suiteStorage.run(this, async () => {
      const error = await execute(this.call, this.timeout)
      if (error) throw error
    })

    /* Setup all sub-suites of this instance */
    for (const suite of this._suites) await suite.setup()

    /* Setup all before/after hooks in the spec */
    for (const spec of this._specs) {
      for (const hook of this._beforeEach) {
        spec.before.push(new Hook(spec, hook.name, hook.call, hook.timeout, hook.flag))
      }
      for (const hook of this._afterEach) {
        spec.after.push(new Hook(spec, hook.name, hook.call, hook.timeout, hook.flag))
      }
    }

    /* If _any_ of this suite's children is marked as "only", then all children
     * not marked as such will be skipped, and this suite will also be marked
     * as "only" (to inform parent suites) */
    const only = this._children.reduce((o, c) => o || (c.flag === 'only'), false)
    if (only) {
      this._children.forEach((c) => (c.flag !== 'only') && (c.flag = 'skip'))
      this.flag = 'only'
    }

    /* If _this_ suite is marked as only, any child not marked with "skip" will
     * be marked as "only" and included in the execution */
    if (this.flag === 'only') {
      this._children.forEach((c) => (c.flag !== 'skip') && (c.flag = 'only'))
    }

    /* If all children are skipped, then this instance is skipped, too */
    for (const child of this._children) {
      if (child.flag !== 'skip') return
    }
    this.flag = 'skip'
  }

  /**
   * Execute this suite, executing all {@link Hook hooks} and children
   * {@link Spec specs} and  {@link Suite suites}
   */
  async execute(executor: Executor, skip: boolean = false): Promise<Error | void> {
    const { done } = executor.start(this)

    /* Potentially skip this (and all children) */
    if (skip || (this.flag === 'skip')) {
      for (const child of this._children) await child.execute(executor, true)
      return done()
    }

    /* Execute all our _before all_ hooks */
    for (const hook of this._beforeAll) {
      const failed = await hook.execute(executor)
      /* Skip this (and all children on) _before all_ failure */
      if (failed) {
        for (const child of this._children) await child.execute(executor, true)
        return done()
      }
    }

    /* Execute all our children (specs or suites) */
    for (const child of this._children) await child.execute(executor)

    /* Execute all our _after all_ hooks (regardless of failures) */
    for (const hook of this._afterAll) await hook.execute(executor)

    /* Done */
    done()
  }
}

/* ========================================================================== */

/** Our {@link Spec} implementation */
export class Spec {
  public before: Hook[] = []
  public after: Hook[] = []

  constructor(
      public readonly parent: Suite,
      public readonly name: string,
      public readonly call: Call,
      public readonly timeout: number = 5000,
      public flag: Flag = undefined,
  ) {}

  /** Execute this spec */
  async execute(executor: Executor, skip: boolean = false): Promise<void> {
    const { done, notify } = executor.start(this)

    /* Potentially skip this */
    if (skip || (this.flag == 'skip')) return done(true)

    /* Execute all our _before each_ hooks */
    for (const hook of this.before) {
      const failed = await hook.execute(executor)
      if (failed) return done(true)
    }

    /* Execute our spec */
    const skipState = { skipped: false }
    await skipStorage.run(skipState, () => execute(this.call, this.timeout, notify))

    /* Execute all our _after all_ hooks (regardless of failures) */
    for (const hook of this.after) await hook.execute(executor)

    /* Done! */
    return done(skipState.skipped)
  }
}

/* ========================================================================== */

/** Our {@link Spec} implementation */
export class Hook {
  constructor(
      public readonly parent: Suite | Spec,
      public readonly name: 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach',
      public readonly call: Call,
      public readonly timeout: number = 5000,
      public readonly flag: Exclude<Flag, 'only'> = undefined,
  ) {}

  /** Execute this hook */
  async execute(executor: Executor): Promise<boolean> {
    if (this.flag === 'skip') return false
    const { done, notify } = executor.start(this)

    const skipState = { skipped: false }
    const error = await skipStorage.run(skipState, () => execute(this.call, this.timeout, notify))
    done(skipState.skipped)
    return !! error
  }
}
