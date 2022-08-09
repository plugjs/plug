import type { AbsolutePath } from '../../paths'
import type { AssertionError } from 'assert'
import type { Files } from '../../files'
import type { MochaOptions } from '../mocha'
import type { Plug } from '../../pipe'

import Mocha from 'mocha'
import ms from 'ms'
import { diffJson } from 'diff'

import { $blu, $grn, $gry, $red, $wht, $ylw, buildFailed, Logger } from '../../log'
import { Run, RunImpl } from '../../run'
import { runAsync } from '../../async'

/** Symbol to inject `Logger` in reporter options */
const logSymbol = Symbol()
/** Symbol to inject `Run` in reporter options */
const runSymbol = Symbol()

/** Worker data, from main thread to worker thread */
export interface MochaMessage {
  /** Task name (for logs) */
  taskName: string,
  /** Build file name */
  buildFile: AbsolutePath
  /** Build directory */
  buildDir: AbsolutePath,
  /** Files directory */
  filesDir: AbsolutePath,
  /** All files to pipe */
  files: AbsolutePath[],
  /** Mocha options */
  options: MochaOptions,
}

/** Writes some info about the current {@link Files} being passed around. */
class MochaRunner implements Plug<undefined> {
  constructor(private readonly _options: MochaOptions) {}

  async pipe(files: Files, run: Run): Promise<undefined> {
    // Enter log here, so that log messages called when loading files get
    // properly indented by our logger
    run.log.notice('') // empty line
    run.log.enter('NOTICE', $wht('Starting Mocha'))

    // Create the mocha runner
    const mocha = new Mocha({
      diff: true, // by defaut enable diffs
      reporter: PlugReporter, // default to our reporter
      ...this._options, // override defaults with all other options
      reporterOptions: {
        ...this._options.reporterOptions,
        [logSymbol]: run.log, // always force a log
        [runSymbol]: run, // always force a run
      },
      allowUncaught: false, // never allow uncaught exceptions
      delay: false, // never delay running
    })

    // Tell mocha about all our files
    for (const file of files.absolutePaths()) mocha.addFile(file)

    // Run mocha!
    return new Promise((resolve, reject) => {
      try {
        mocha.run((failures) => {
          if (failures) reject(buildFailed)
          resolve(undefined)
        })
      } catch (error) {
        reject(error)
      }
    })
  }
}

/* ========================================================================== *
 * LOGGER / REPORTER                                                          *
 * ========================================================================== */

const _pending = '\u22EF' // middle ellipsis
const _success = '\u2714' // heavy check mark
const _failure = '\u2718' // heavy ballot x
const _details = '\u21B3' // downwards arrow with tip rightwards

class PlugReporter extends Mocha.reporters.Base {
  constructor(runner: Mocha.Runner, options: Mocha.MochaOptions) {
    super(runner, options)

    const showDiff = !! options.diff
    const log = options.reporterOptions[logSymbol] as Logger
    const failures: Mocha.Test[] = []
    const rootSuite = runner.suite

    // Enter a suite (increase indent)
    runner.on('suite', (suite) => {
      if (suite === rootSuite) return
      log.notice('')
      log.enter('NOTICE', `${$wht(suite.title)}`)
    })

    // Leave a suite (decrease indent)
    runner.on('suite end', () => {
      log.leave()
    })

    // Enter a test (increase indent)
    runner.on('test', (test) => {
      log.enter('NOTICE', `${$blu(_pending)} ${test.title}`)
    })

    // Leave a test (handle warning/failures and decrease indent)
    runner.on('test end', (test) => {
      if (test.isPassed()) {
        log.leave('NOTICE', `${$grn(_success)} ${test.title}`)
      } else if (test.isPending()) {
        const tag = $gry('[') + $ylw('skipped') + $gry(']')
        log.leave('WARN', `${$ylw(_pending)} ${test.title} ${tag}`)
      } else if (test.isFailed()) {
        const number = failures.push(test)
        const tag = $gry('[') + $red('failed') + $gry('|') + $red(number) + $gry(']')
        log.leave('ERROR', `${$red(_failure)} ${test.title} ${tag}`)
      }
    })

    // Mocha finished running, dump our report
    runner.once('end', () => {
      // Each failure gets dumped individually
      for (let i = 0; i < failures.length; i ++) {
        log.notice('')
        const failure = failures[i]

        // The titles (from the suite, up to the test)
        const titles = [ failure.title ]
        for (let parent = failure.parent; parent; parent = parent?.parent) {
          if (parent.parent) titles.unshift(parent.title)
        }

        // Log out our titles (one per line, indented)
        log.error(`${$gry('Failure [')}${$red(i + 1)}${$gry(']')}`)
        titles.forEach((title, indent) => {
          log.error(`  ${''.padStart(indent * 4)}${$gry(_details)} ${$wht(title)}`)
        })

        // If we have an error, luckily this is an `Error` instance
        if (failure.err) {
          const message = `${failure.err}` // this is the message, can be multiple lines
          const messageOrStack = failure.err.stack || `${failure.err}` // maybe a stack?
          const messageIndex = messageOrStack.indexOf(message)

          // Subtrack the message from the stack
          const stack =
            messageOrStack === message ? '' :
            messageIndex < 0 ? messageOrStack :
            messageOrStack.substring(messageIndex + message.length)

          // Split and clean up stack lines
          const stackLines = stack.split('\n')
              .map((line) => line.trim())
              .filter((line) => !! line)

          // Output the message
          log.enter('ERROR', '')
          log.error($red(message))

          // Should we diff?
          if (showDiff && ('actual' in failure.err) && ('expected' in failure.err)) {
            const err = failure.err as AssertionError
            const changes = diffJson(err.actual as any, err.expected as any)

            const diff = changes.map((change): string => {
              if (change.removed) return $red(change.value)
              if (change.added) return $grn(change.value)
              return $gry(change.value)
            }).join('')

            log.enter('ERROR', `${$gry('diff')} ${$grn('expected')}  ${$gry('/')} ${$red('actual')}`)
            log.error(diff)
            log.leave()
          }

          // Dump our stack trace and leave
          stackLines.forEach((line) => log.error(line))
          log.leave()
        }
      }

      // If we have some statistics, then let's dump them out in pretty colors
      if (runner.stats) {
        log.notice('')
        const { passes, pending, failures, duration = 0 } = runner.stats
        const fmt = (n: number): string => n === 1 ? `${n} test` : `${n} tests`
        if (passes) log.notice($grn(fmt(passes)), 'passing', $gry(`[${ms(duration)}]`))
        if (pending) log.warn($ylw(fmt(pending)), 'pending')
        if (failures) log.error($red(fmt(failures)), 'pending')
      }

      // Done...
      log.notice('')
    })
  }
}


/* ========================================================================== *
 * RUNNER STARTUP                                                             *
 * ========================================================================== */

const timeout = setTimeout(() => {
  // eslint-disable-next-line no-console
  console.error('Mocha not initialized in 5 seconds')
  process.exit(2)
}, 5000)

process.on('message', async (message: MochaMessage) => {
  clearTimeout(timeout)

  const { taskName, options } = message

  const run = new RunImpl({
    buildDir: message.buildDir,
    buildFile: message.buildFile,
    taskName: message.taskName,
  })

  const files = run.files(message.filesDir).add(...message.files).build()

  await runAsync(run, taskName, () => new MochaRunner(options).pipe(files, run))
      .then(() => process.exit(0))
      .catch((error) => {
        run.log.error(error)
        process.exit(1)
      })
})
