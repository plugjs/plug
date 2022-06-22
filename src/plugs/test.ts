import assert from 'node:assert'
import { ChildProcess, fork } from 'node:child_process'
import readline  from 'node:readline'

import { randomUUID } from 'crypto'
import { Files } from '../files'
import { $p, TaskLogger, log, $grn, $ylw, $gry, $red, $blu, fail } from '../log'
import type { Plug } from '../pipe'
import type { Run } from '../run'
import type { TestMessage } from '../test'

export class Test implements Plug {
  constructor() {
    // No args for now!!!
  }

  async pipe(run: Run, files: Files): Promise<Files> {
    const log = new TaskLogger() // we hate callbacks!
    const uuid = randomUUID()

    log.info('Executing', files.length, 'test files')

    const reporter = new TestReporter()

    for (const file of files.absolutePaths()) {
      await new Promise<void>((resolve, reject) => {
        log.sep().debug('Executing', $p(file))
        let child: ChildProcess | undefined = undefined

        try {
          child = fork(file, [], {
            stdio: [ 'ignore', 'pipe', 'pipe', 'ipc' ],
            env: { ...process.env, __TEST_RUN_UUID__: uuid },
            serialization: 'advanced',
          })

          assert(child.stdout, 'No standard output from child process')
          assert(child.stderr, 'No standard error from child process')

          const stdout = readline.createInterface(child.stdout)
          const stderr = readline.createInterface(child.stderr)
          stdout.on('line', (line) => log.info(`${$blu('\u25b6')} ${$gry(line)}`))
          stderr.on('line', (line) => log.info(`${$ylw('\u25b6')} ${$gry(line)}`))

          const adapters = new TestLogAdapters(reporter)

          child.on('message', (message: TestMessage) => {
            log.trace('Received message', message)
            if (message.test_run_uuid === uuid) adapters.handle(message)
          })

          child.on('error', (error) => reject(error))
          child.on('close', (code, signal) => {
            if (signal) reject(`Script "${file}" exited with signal "${signal}"`)
            else if (code) reject(`Script "${file}" exited with code ${code}`)
            else resolve()
          })

        } catch (error) {
          if (child) {
            child.kill('SIGTERM')
            child.on('close', () => reject(error))
          } else {
            reject(error)
          }
        }
      })
    }

    /* Nice report! */
    const results: string[] = []
    if (reporter.passed) results.push(`${$grn(reporter.passed)} passed`)
    if (reporter.failed) results.push(`${$red(reporter.failed)} failed`)
    if (reporter.skipped) results.push(`${$ylw(reporter.skipped)} skipped`)
    const message = results.length ? `${$gry('(')}${results.join($gry(', '))}}${$gry(')')}` : ''

    log.sep().info(`Ran ${reporter.total} tests`, message)

    for (const failure of reporter.failures) {
      log.sep().error('Failure detected in')
      let prefix = ` ${$gry('\u2514\u2500')}`
      for (const label of failure.labels) {
        log.error(prefix, label)
        prefix = '   ' + prefix
      }
      log.error(failure.failure)
    }

    if (reporter.failed) fail('Failed', reporter.failed, 'tests')

    /* Always return some empty results */
    return new Files(run) // empty results!
  }
}

export function test() {
  return new Test()
}

class TestReporter {
  readonly #failures: TestFailure[] = []
  #total: number = 0
  #passed: number = 0
  #skipped: number = 0

  constructor() {
    /* Nothing to do */
  }

  reportStarted() {
    this.#total ++
  }

  reportPassed() {
    this.#passed ++
  }

  reportSkipped() {
    this.#skipped ++
  }

  reportFailed(failure: TestFailure) {
    this.#failures.push(failure)
  }

  get total(): number {
    return this.#total
  }

  get passed(): number {
    return this.#passed
  }

  get skipped(): number {
    return this.#skipped
  }

  get failed(): number {
    return this.#failures.length
  }

  get failures(): TestFailure[] {
    return [ ...this.#failures ]
  }
}

class TestFailure {
  readonly labels: readonly string[]
  readonly failure: any

  constructor(adapter: TestLogAdapter, failure: any) {
    const labels: string[] = []

    while (adapter != adapter.parent) {
      labels.unshift(adapter.label)
      adapter = adapter.parent
    }

    this.failure = failure
    this.labels = labels
  }
}

class TestLogAdapters {
  readonly #adapters: Record<number, TestLogAdapter> = {}
  readonly #reporter: TestReporter

  constructor(reporter: TestReporter) {
    this.#reporter = reporter
  }

  handle(message: TestMessage) {
    if (message.event === 'start') {
      const adapter = new TestLogAdapter(message.id, message.label, this.#adapters[message.parent])
      this.#adapters[message.id] = adapter
      this.#reporter.reportStarted()

    } else {
      const adapter = this.#adapters[message.id]
      assert(adapter, `No test started with id ${message.id}`)

      switch(message.event) {
        case 'skip': this.#reporter.reportSkipped(); break
        case 'pass': this.#reporter.reportPassed(); break
        case 'fail':
          const failure = new TestFailure(adapter, message.failure)
          this.#reporter.reportFailed(failure)
          break
      }

      adapter.handle(message)
    }
  }
}

class TestLogAdapter {
  readonly id: number
  readonly parent: TestLogAdapter
  readonly label: string

  readonly #indent: string
  #started: boolean

  constructor(id: number, label: string, parent?: TestLogAdapter) {
    this.id = id
    this.label = label

    if (parent) {
      this.parent = parent
      this.#indent = parent.#indent + '  '
      this.#started = parent.id === id
    } else {
      this.parent = this
      this.#indent = ''
      this.#started = true
    }
  }

  #start() {
    if (this.#started) return
    const extra = `${$gry('(')}${$blu('\u2026')}${$gry(')')}`
    log.info(this.#indent + $blu('\u2022'), this.label, extra)
    this.#started = true
  }

  handle(message: TestMessage): void {
    if (this.parent === this) return

    if (message.event === 'pass') {
      this.parent.#start()
      log.info(this.#indent + $grn('\u2714'), this.label)

    } else if (message.event === 'skip') {
      this.parent.#start()
      const extra = `${$gry('(')}${$ylw('skipped')}${$gry(')')}`
      log.info(this.#indent + $ylw('\u25aa'), this.label, extra)

    } else if (message.event === 'fail') {
      this.parent.#start()
      const extra = `${$gry('(')}${$red('failed')}${$gry(')')}`
      log.info(this.#indent + $red('\u2716'), this.label, extra)

    } else {
      log.warn('Unhandled message', message)
    }
  }
}
