import assert from 'assert'
import { ChildProcess, fork } from 'child_process'
import { randomUUID } from 'crypto'
import { Files } from '../files'
import { $p, TaskLogger, Logger, log } from '../log'
import type { Plug } from '../pipe'
import type { Run } from '../run'
import type { TestMessage, TestStartMessage } from '../test'

export class Test implements Plug {
  constructor() {
    // No args for now!!!
  }

  async pipe(run: Run, files: Files): Promise<Files> {
    const log = new TaskLogger() // we hate callbacks!
    const uuid = randomUUID()

    log.info('Executing', files.length, 'test files')

    for (const file of files.absolutePaths()) {
      await new Promise<void>((resolve, reject) => {
        log.debug('Executing', $p(file))
        let child: ChildProcess | undefined = undefined

        try {
          child = fork(file, [], {
            stdio: [ 'ignore', 'pipe', 'pipe', 'ipc' ],
            env: { ...process.env, __TEST_RUN_UUID__: uuid },
            serialization: 'advanced',
          })

          assert(child.stdout, 'No standard output from child process')
          assert(child.stderr, 'No standard error from child process')
          child.stdout.pipe(process.stdout)
          child.stderr.pipe(process.stderr)

          const adapter = new TestAdapter()

          child.on('message', (message: TestMessage) => {
            if (message.test_run_uuid !== uuid) return
            adapter.handle(message)
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

    /* Always return some empty results */
    return new Files(run) // empty results!
  }
}

export function test() {
  return new Test()
}

class TestAdapter {
  readonly id: number
  readonly parent: TestAdapter
  readonly label: string
  readonly adapters: Record<number, TestAdapter>
  readonly indent: number
  started = false

  constructor()
  constructor(id: number, label: string, parent: TestAdapter)
  constructor(id?: number, label?: string, parent?: TestAdapter) {
    if (id && label && parent) {
      this.id = id
      this.label = label
      this.parent = parent
      this.adapters = parent.adapters
      this.indent = parent.indent + 1
    } else {
      this.id = 0
      this.label = ''
      this.parent = this
      this.adapters = {}
      this.indent = 0
      this.started = true
    }
    this.adapters[this.id] = this
  }

  get pad(): string {
    return ''.padStart((this.indent * 2) - 1, ' ')
  }

  start() {
    if (this.started) return
    const tag = log.options.colors ? `\u001b[34m\u2022\u001b[0m` : '\u2022'
    log.info(this.pad, tag, this.label)
    this.started = true
  }

  handle(message: TestMessage) {
    if (message.event === 'start') {
      new TestAdapter(message.id, message.label, this.adapters[message.parent])
    } else if (message.id !== this.id) {
      const adapter = this.adapters[message.id]
      assert(adapter, `No test started with id ${message.id}`)
      adapter.handle(message)
    } else if (message.event === 'pass') {
      this.parent.start()
      const tag = log.options.colors ? `\u001b[32m\u2714\u001b[0m` : '\u2714'
      log.info(this.pad, tag, this.label)
    } else if (message.event === 'skip') {
      this.parent.start()
      const tag = log.options.colors ? `\u001b[33m\u25aa\u001b[0m` : '\u25aa'
      const extra = log.options.colors ? `\u001b[90m(\u001b[33mskipped\u001b[90m)\u001b[0m` : '(skipped)'
      log.info(this.pad, tag, this.label, extra)
    } else if (message.event === 'fail') {
      this.parent.start()
      const tag = log.options.colors ? `\u001b[31m\u2716\u001b[0m` : '\u2716'
      const extra = log.options.colors ? `\u001b[90m(\u001b[31mfailed\u001b[90m)\u001b[0m` : '(failed)'
      log.info(this.pad, tag, this.label, extra)
    }
  }
}
