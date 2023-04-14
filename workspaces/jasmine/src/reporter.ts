import { AssertionError } from 'node:assert'

import {
  $blu, $grn, $gry, $ms, $red, $wht, $ylw,
  ERROR, NOTICE, WARN,
  githubAnnotation,
} from '@plugjs/plug/logging'
import { getTypeOf, textDiff } from '@plugjs/plug/utils'

import type { Logger } from '@plugjs/plug/logging'

const _pending = '\u22EF' // middle ellipsis
const _success = '\u2714' // heavy check mark
const _failure = '\u2718' // heavy ballot x
const _details = '\u2192' // rightwards arrow

// Union of spec and suite results, with our suite names stack
type JasmineFailure = (jasmine.SpecResult | jasmine.SuiteResult) & {
  suiteStack: string[]
}

// See our "HACK" in the Jasmine Plug, injecting the "originalError"
// field in failed expectations. We need this for pretty printing below
type JasmineFailedExpectation = jasmine.FailedExpectation & {
  originalError?: Error & {
    operator?: string,
    expected?: any,
    actual?: any,
  }
}

// A class that will nicely print a "failed expectation" to a given logger
class FailedExpectationLogger {
  constructor(
      private _logger: Logger,
      private _showDiff: boolean,
      private _showStack: boolean,
  ) {}

  logFailedExpectation(expectation: JasmineFailedExpectation): void {
    // If we have an original error, it might be an assertion error (or not!)
    const assertionError = expectation.originalError instanceof AssertionError ?
        expectation.originalError : undefined
    const originalError = expectation.originalError instanceof Error ?
        expectation.originalError : undefined

    // Start figuring out the message and "matcher"
    void assertionError, originalError

    const message = (
      assertionError ? 'Assertion Error: ' + assertionError.message.split('\n')[0]?.trim() :
      originalError ? originalError.toString() :
      expectation.message
    ) || /* coverage ignore next */ expectation.message

    const matcherName =
      originalError?.operator ? ` (operator: "${originalError.operator}")` :
      expectation.matcherName ? ` (matcher: "${expectation.matcherName}")` :
      ''

    this._logger.enter(ERROR, `${$red(message)}${$gry(matcherName)}`)

    // Figure out if we have to prepare a difference between the actual
    // and expected value, and if one is emitted mark `hasDiff` to `true`
    let hasDiff = false
    if (this._showDiff) {
      // First of all figure out actual and expected, either from the original
      // error, or (if missing) from the actual Jasmine expectation
      const { actual, expected } =
        (originalError?.actual || originalError?.expected) ? originalError :
        expectation

      // Compute the difference as a nicely formatted string
      const difference = textDiff(actual, expected)

      // If we have a difference, log it out
      if (difference) {
        // Highlight the _types_ of the objects we diff, if not the same
        const actualType = getTypeOf(actual)
        const expectedType = getTypeOf(expected)

        if (actualType === expectedType) {
          this._logger.enter(ERROR, `${$gry('diff')} ${$red('actual')} ${$gry('/')} ${$grn('expected')}`)
        } else {
          this._logger.enter(ERROR, [
            $gry('diff'),
            $red('actual'), $gry(`(${actualType})`),
            '/',
            $grn('expected'), $gry(`(${expectedType})`),
          ].join(' '))
        }

        // Print out the differences...
        this._logger.error(difference)
        this._logger.leave()
        hasDiff = true
      }
    }

    // If we want stack traces, log them out
    if (expectation.stack && this._showStack) {
      // The _stack_ of the call gets pruned to contain _only_ stack traces
      const stack = expectation.stack.split('\n')
          .map((line) => line.trim())
          .filter((line) => line.startsWith('at '))
          .filter((line) => line.indexOf('<Jasmine>') < 0)

      // If we actually have anything to log (from above) do log line by line
      if (stack.length) {
        if (hasDiff) this._logger.enter() // one more indent if diffs were shown
        this._logger.enter()
        stack.forEach((line) => this._logger.error($gry(line)))
        if (hasDiff) this._logger.leave() // one less indent if diffs were shown
        this._logger.leave()
      }
    }

    // All done, this expectation is logged...
    this._logger.leave()
  }
}

/* ========================================================================== *
 * JASMINE REPORTER IMPLEMENTATION                                            *
 * ========================================================================== */

export class Reporter implements jasmine.CustomReporter {
  private _failedExpectationLogger: FailedExpectationLogger
  private _failures: JasmineFailure[] = []
  private _stack: string[] = []
  private _newline = true

  constructor(
      private _logger: Logger,
      _showDiff: boolean,
      _showStack: boolean,
  ) {
    this._failedExpectationLogger = new FailedExpectationLogger(_logger, _showDiff, _showStack)
  }

  jasmineStarted(suiteInfo: jasmine.JasmineStartedInfo): void {
    this._logger.enter(NOTICE, `Jasmine running ${$ylw(suiteInfo.totalSpecsDefined)} specs`)
  }

  suiteStarted(result: jasmine.SuiteResult): void {
    this._stack.push(result.description)
    this._newline = false
    this._logger.notice('')
    this._logger.enter(NOTICE, $wht(result.description))
  }

  specStarted(result: jasmine.SpecResult): void {
    if (this._newline) this._newline = (this._logger.notice(''), false)
    this._logger.enter(NOTICE, `${$blu(_pending)} ${result.description}`)
  }

  specDone(result: jasmine.SpecResult): void {
    const { status, description, duration } = result
    const ms = $ms(duration || 0)
    let number: number | undefined

    switch (status) {
      case 'passed':
        this._logger.leave(NOTICE, `${$grn(_success)} ${description} ${ms}`)
        break

      case 'failed':
        githubAnnotation({ type: 'error', title: `Jasmine spec ${status}` }, description)
        number = this._failures.push(Object.assign(result, { suiteStack: [ ...this._stack ] }))
        this._logger.leave(ERROR,
            `${$red(_failure)} ${description} ${ms} ` +
            `${$gry('[')}${$red('failed')}${$gry('|')}${$red(`${number}`)}${$gry(']')}`)
        break

      default: // 'pending', 'excluded', ... maybe others?
        githubAnnotation({ type: 'warning', title: `Jasmine spec ${status}` }, description)
        this._logger.leave(WARN, `${$ylw(_pending)} ${description} ${$gry('[')}${$ylw(status)}${$gry(']')}`)
    }
  }

  suiteDone(result: jasmine.SuiteResult): void {
    this._stack.pop()
    this._newline = true
    this._logger.leave()

    if (result.status === 'failed') {
      this._failures.push(Object.assign(result, { suiteStack: [ ...this._stack ] }))
    }
  }

  jasmineDone(runDetails: jasmine.JasmineDoneInfo): void {
    this._logger.leave()


    this._failures.forEach((result, i) => {
      this._logger.error('')

      // nice header disclosing all parent suite names
      const names = result.suiteStack.map((name) => $gry(name))
      names.push($wht(result.description))
      const details = names.join(` ${_details} `)

      this._logger.enter(ERROR, `${$gry('[')}${$red(i + 1)}${$gry(']:')} ${details}`)

      result.failedExpectations.forEach((expectation) => {
        this._failedExpectationLogger.logFailedExpectation(expectation)
      })
      this._logger.leave()
    })

    if (runDetails.failedExpectations.length) {
      this._logger.error('')
      this._logger.enter(ERROR, `${$gry('[')}${$red(this._failures.length + 1)}${$gry(']:')}`)
      runDetails.failedExpectations.forEach((expectation) => {
        this._failedExpectationLogger.logFailedExpectation(expectation)
      })
      this._logger.leave()
    }
  }
}
