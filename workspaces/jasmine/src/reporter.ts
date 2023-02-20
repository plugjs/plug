import { $blu, $grn, $gry, $ms, $red, $wht, $ylw, ERROR, NOTICE, WARN } from '@plugjs/plug/logging'

import type { Logger } from '@plugjs/plug/logging'

const _pending = '\u22EF' // middle ellipsis
const _success = '\u2714' // heavy check mark
const _failure = '\u2718' // heavy ballot x
const _details = '\u2192' // rightwards arrow

export class Reporter implements jasmine.CustomReporter {
  private _failures: ((jasmine.SpecResult | jasmine.SuiteResult) & { stack: string[] })[] = []
  private _stack: string[] = []
  private _newline = true

  constructor(private _logger: Logger) {}

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
        number = this._failures.push(Object.assign(result, { stack: [ ...this._stack ] }))
        this._logger.leave(ERROR,
            `${$red(_failure)} ${description} ${ms} ` +
            `${$gry('[')}${$red('failed')}${$gry('|')}${$red(`${number}`)}${$gry(']')}`)
        break

      default: // 'pending', 'excluded', ... maybe others?
        this._logger.leave(WARN, `${$ylw(_pending)} ${description} ${$gry('[')}${$ylw(status)}${$gry(']')}`)
    }
  }

  suiteDone(result: jasmine.SuiteResult): void {
    this._stack.pop()
    this._newline = true
    this._logger.leave()

    if (result.status === 'failed') {
      this._failures.push(Object.assign(result, { stack: [ ...this._stack ] }))
    }
  }

  jasmineDone(runDetails: jasmine.JasmineDoneInfo): void {
    this._logger.leave()

    const logFailedExpectation = (expectation: jasmine.FailedExpectation): void => {
      const stack = expectation.stack.split('\n')
          .filter((line) => line.indexOf('<Jasmine>') < 0)
          .filter((line) => !! line.match(/\S/))
          .join('\n')
      this._logger.error($red(`  ${expectation.message}`))
      if (stack) this._logger.error(stack)
    }

    this._failures.forEach((result, i) => {
      this._logger.error('')

      // nice header disclosing all parent suite names
      const names = result.stack.map((name) => $gry(name))
      names.push($wht(result.description))
      const details = names.join(` ${_details} `)

      this._logger.enter(ERROR, `${$gry('[')}${$red(i + 1)}${$gry(']:')} ${details}`)
      result.failedExpectations.forEach(logFailedExpectation)
      this._logger.leave()
    })

    if (runDetails.failedExpectations.length) {
      this._logger.error('')
      this._logger.enter(ERROR, `${$gry('[')}${$red(this._failures.length + 1)}${$gry(']:')}`)
      runDetails.failedExpectations.forEach(logFailedExpectation)
      this._logger.leave()
    }
  }
}
