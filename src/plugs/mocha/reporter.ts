import { diffJson } from 'diff'
import RealMocha from 'mocha' // Mocha types pollute the global scope!

import { $blu, $grn, $gry, $ms, $red, $wht, $ylw, ERROR, NOTICE, WARN } from '../../logging'

import type { Logger } from '../../logging'
import type { AssertionError } from 'node:assert'

const _pending = '\u22EF' // middle ellipsis
const _success = '\u2714' // heavy check mark
const _failure = '\u2718' // heavy ballot x
const _details = '\u21B3' // downwards arrow with tip rightwards

/* ========================================================================== *
 * LOGGER / REPORTER                                                          *
 * ========================================================================== */

/** Symbol to inject `Logger` in reporter options */
export const logSymbol = Symbol()

export class PlugReporter extends RealMocha.reporters.Base {
  constructor(runner: RealMocha.Runner, options: RealMocha.MochaOptions) {
    super(runner, options)

    const showDiff = !! options.diff
    const log = options.reporterOptions[logSymbol] as Logger
    const failures: RealMocha.Test[] = []
    const rootSuite = runner.suite
    let slow = 0

    // Enter a suite (increase indent)
    runner.on('suite', (suite) => {
      if (suite === rootSuite) return
      log.notice('')
      log.enter(NOTICE, `${$wht(suite.title)}`)
    })

    // Leave a suite (decrease indent)
    runner.on('suite end', () => {
      log.leave()
    })

    runner.on('fail', (test) => {
      // Hooks fail here (not on "hook end")
      if (test.type as any === 'hook') {
        const number = failures.push(test)
        const tag = $gry('[') + $red('failed') + $gry('] [') + $red(number) + $gry(']')
        log.error(`${$red(_failure)} ${test.title} ${tag}`)
      }
    })

    // Enter a test (increase indent)
    runner.on('test', (test) => {
      // mark that we _entered_ the test ('pending' might be called)
      (<any> test).__plugjs__entered = true
      log.enter(NOTICE, `${$blu(_pending)} ${test.title}`)
    })

    // Enter a pending test (increase indent)
    runner.on('pending', (test) => {
      // pending is also called when "this.skip" gets called inside the test
      if ((<any> test).__plugjs__entered === true) return
      log.enter(NOTICE, `${$blu(_pending)} ${test.title}`)
    })

    // Leave a test (handle warning/failures and decrease indent)
    runner.on('test end', (test) => {
      if (test.isPassed()) {
        const duration = test.duration || 0
        if (duration < test.slow()) {
          log.leave(NOTICE, `${$grn(_success)} ${test.title}`)
        } else {
          log.leave(WARN, `${$ylw(_success)} ${test.title} ${$ms(duration, 'slow')}`)
          slow ++
        }
      } else if (test.isPending()) {
        const tag = $gry('[') + $ylw('skipped') + $gry(']')
        log.leave(WARN, `${$ylw(_pending)} ${test.title} ${tag}`)
      } else if (test.isFailed()) {
        const number = failures.push(test)
        const tag = $gry('[') + $red('failed') + $gry('] [') + $red(number) + $gry(']')
        log.leave(ERROR, `${$red(_failure)} ${test.title} ${tag}`)
      }
    })

    // Mocha finished running, dump our report
    runner.once('end', () => {
      // console.log('[end]')
      try {
        // Each failure gets dumped individually
        for (let i = 0; i < failures.length; i ++) {
          log.notice('')
          const failure = failures[i]!

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
            log.enter(ERROR, '')
            log.error($red(message))

            // Should we diff?
            if (showDiff && ('actual' in failure.err) && ('expected' in failure.err)) {
              const err = failure.err as AssertionError
              const actual =
                err.actual === undefined ? '[undefined]' :
                err.actual === null ? '[null]' :
                err.actual

              const expected =
                err.expected === undefined ? '[undefined]' :
                err.expected === null ? '[null]' :
                err.expected

              const changes = diffJson(actual as any, expected as any)

              const diff = changes.map((change): string => {
                if (change.removed) return $red(change.value)
                if (change.added) return $grn(change.value)
                return $gry(change.value)
              }).join('')

              log.enter(ERROR, `${$gry('diff')} ${$grn('expected')}  ${$gry('/')} ${$red('actual')}`)
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
          if (passes) log.notice($grn(fmt(passes)), 'passing', $ms(duration))
          if (slow) log.warn($ylw(fmt(slow)), 'slow')
          if (pending) log.warn($ylw(fmt(pending)), 'pending')
          if (failures) log.error($red(fmt(failures)), 'failed')
        }

        // Done...
        log.notice('')
      } catch (error) {
        log.error('Error rendering Mocha report', error)
      }
    })
  }
}
