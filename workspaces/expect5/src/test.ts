import { AssertionError } from 'node:assert'

import { BuildFailure } from '@plugjs/plug'
import { assert } from '@plugjs/plug/asserts'
import { $blu, $grn, $gry, $ms, $p, $plur, $red, $wht, $ylw, ERROR, NOTICE, WARN, githubAnnotation, log } from '@plugjs/plug/logging'
import { dirnameFromUrl, filenameFromUrl } from '@plugjs/plug/paths'

import { Suite, skip } from './execution/executable'
import { runSuite } from './execution/executor'
import * as setup from './execution/setup'
import { diff } from './expectation/diff'
import { expect } from './expectation/expect'
import { printDiff } from './expectation/print'
import { ExpectationError, stringifyValue } from './expectation/types'

import type { Files } from '@plugjs/plug/files'
import type { Logger } from '@plugjs/plug/logging'
import type { Context, PipeParameters, Plug } from '@plugjs/plug/pipe'
import type { Record } from './execution/executor'
import type { TestOptions } from './index'

const _pending = '\u22EF' // middle ellipsis
const _success = '\u2714' // heavy check mark
const _failure = '\u2718' // heavy ballot x
const _details = '\u2192' // rightwards arrow

/** Writes some info about the current {@link Files} being passed around. */
export class Test implements Plug<void> {
  constructor(...args: PipeParameters<'test'>)
  constructor(private readonly _options: TestOptions = {}) {}

  async pipe(files: Files, context: Context): Promise<void> {
    assert(files.length, 'No files available for running tests')

    const {
      globals = true,
      genericErrorDiffs = true,
      maxFailures = Number.POSITIVE_INFINITY,
      summary = false,
    } = this._options

    // Inject globals if we were told to do so...
    if (globals) {
      const anyGlobal = globalThis as any

      anyGlobal['describe'] = setup.describe
      anyGlobal['fdescribe'] = setup.fdescribe
      anyGlobal['xdescribe'] = setup.xdescribe
      anyGlobal['it'] = setup.it
      anyGlobal['fit'] = setup.fit
      anyGlobal['xit'] = setup.xit
      anyGlobal['afterAll'] = setup.afterAll
      anyGlobal['afterEach'] = setup.afterEach
      anyGlobal['beforeAll'] = setup.beforeAll
      anyGlobal['beforeEach'] = setup.beforeEach
      anyGlobal['xafterAll'] = setup.xafterAll
      anyGlobal['xafterEach'] = setup.xafterEach
      anyGlobal['xbeforeAll'] = setup.xbeforeAll
      anyGlobal['xbeforeEach'] = setup.xbeforeEach
      anyGlobal['skip'] = skip
      anyGlobal['expect'] = expect
      anyGlobal['log'] = log
      anyGlobal['dirnameFromUrl'] = dirnameFromUrl
      anyGlobal['filenameFromUrl'] = filenameFromUrl
    }

    // Create our _root_ Suite
    const suite = new Suite(undefined, '', async () => {
      let count = 0
      for (const file of files.absolutePaths()) {
        log.debug('Importing', $p(file), 'in suite', $gry(`(${++ count}/${files.length})`))
        await import(file)
      }
    })

    // Setup our suite counts
    await suite.setup()

    const snum = suite.specs
    const fnum = files.length
    const smsg = $plur(snum, 'spec', 'specs')
    const fmsg = $plur(fnum, 'file', 'files')

    assert(snum, 'No specs configured by test files')

    // Run our suite and setup listeners
    const execution = runSuite(suite)

    execution.on('suite:start', (current) => {
      if (current.parent === suite) {
        if (suite.flag !== 'only') context.log.notice('')
        context.log.enter(NOTICE, `${$wht(current.name)}`)
        context.log.notice('')
      } else if (current.parent) {
        context.log.enter(NOTICE, `${$blu(_details)} ${$wht(current.name)}`)
      } else {
        context.log.notice(`Running ${smsg} from ${fmsg}`)
        if (suite.flag === 'only') context.log.notice('')
      }
    })

    execution.on('suite:done', (current) => {
      if (current.parent) context.log.leave()
    })

    execution.on('spec:start', (spec) => {
      context.log.enter(NOTICE, `${$blu(_pending)} ${spec.name}`)
    })

    execution.on('spec:skip', (spec, ms) => {
      if (suite.flag === 'only') return context.log.leave()
      context.log.leave(WARN, `${$ylw(_pending)} ${spec.name} ${$ms(ms, $ylw('skipped'))}`)
    })

    execution.on('spec:pass', (spec, ms, slow) => {
      if (slow) {
        context.log.leave(WARN, `${$ylw(_success)} ${spec.name} ${$ms(ms, $ylw('slow'))}`)
      } else {
        context.log.leave(NOTICE, `${$grn(_success)} ${spec.name} ${$ms(ms)}`)
      }
    })

    execution.on('spec:fail', (spec, ms, { number }) => {
      context.log.leave(ERROR,
          `${$red(_failure)} ${spec.name} ${$ms(ms)} ` +
          `${$gry('[')}${$red('failed')}${$gry('|')}${$red(`${number}`)}${$gry(']')}`)
    })

    execution.on('hook:fail', (hook, ms, { number }) => {
      context.log.error(`${$red(_failure)} Hook "${hook.name}" ${$ms(ms)} ` +
          `${$gry('[')}${$red('failed')}${$gry('|')}${$red(`${number}`)}${$gry(']')}`)
    })

    // Await execution
    const { failed, passed, skipped, failures, time, records } = await execution.result

    // Dump all (or a limited number of) failures
    const limit = Math.min(failures.length, maxFailures)
    for (let i = 0; i < limit; i ++) {
      if (i === 0) context.log.error('')
      const { source, error, number } = failures[i]!

      const names: string[] = [ '' ]
      for (let p = source.parent; p?.parent; p = p.parent) {
        if (p) names.unshift(p.name)
      }
      const details = names.join(` ${$gry(_details)} `) + $wht(source.name)

      context.log.enter(ERROR, `${$gry('[')}${$red(number)}${$gry(']:')} ${details}`)
      dumpError(context.log, error, genericErrorDiffs)
      context.log.leave()
    }

    // Summary
    if (summary) {
      context.log.notice('')
      context.log.notice($wht('Test execution summary:'))
      records.forEach((record) => dumpRecords(context.log, record))
    }

    // Epilogue
    const totals: string[] = [ `${passed} ${$gry('passed')}` ]
    if (skipped) totals.push(`${skipped} ${$gry('skipped')}`)
    if (failed) totals.push(`${failed} ${$gry('failed')}`)
    if (failures.length) totals.push(`${failures.length} ${$gry('total failures')}`)

    const epilogue = `${$gry('(')}${totals.join($gry(', '))}${$gry(')')}`
    const message = `Ran ${smsg} from ${fmsg} ${epilogue} ${$ms(time)}`

    if (failures.length) {
      context.log.error(message)
      throw new BuildFailure()
    } else if (suite.flag === 'only') {
      context.log.error('')
      context.log.error(message)
      throw new BuildFailure('Suite running in focus ("only") mode')
    } else if (skipped) {
      context.log.warn('')
      context.log.warn(message)
    } else {
      context.log.notice('')
      context.log.notice(message)
    }
  }
}

/* ========================================================================== *
 * RECORDS REPORTING                                                          *
 * ========================================================================== */

function dumpRecords(log: Logger, record: Record): void {
  if (record.type === 'suite') {
    log.enter(NOTICE, `${$wht(record.name)}`)
    for (const r of record.records) dumpRecords(log, r)
    log.leave()
  } else if (record.type === 'spec') {
    switch (record.result) {
      case 'passed':
        if (record.slow) {
          log.notice(`${$ylw(_success)} ${record.name} ${$ms(record.ms, $ylw('slow'))}`)
        } else {
          log.notice(`${$grn(_success)} ${record.name} ${$ms(record.ms)}`)
        }
        break

      case 'skipped':
        log.notice(`${$ylw(_pending)} ${record.name} ${$ms(record.ms, $ylw('skipped'))}`)
        break
      case 'failed':
        log.notice(
            `${$red(_failure)} ${record.name} ${$ms(record.ms)} ` +
            `${$gry('[')}${$red('failed')}${$gry('|')}${$red(`${record.failure}`)}${$gry(']')}`)
        break
    }
  } else if (record.type === 'hook') {
    log.error(`${$red(_failure)} Hook "${record.name}" ${$gry('[')}${$red('failed')}${$gry('|')}${$red(`${record.failure}`)}${$gry(']')}`)
  }
}


/* ========================================================================== *
 * ERROR REPORTING                                                            *
 * ========================================================================== */

function dumpError(log: Logger, error: any, genericErrorDiffs: boolean): void {
  // First and foremost, our own expectation errors
  if (error instanceof ExpectationError) {
    log.enter(ERROR, `${$gry('Expectation Error:')} ${$red(error.message)}`)
    githubAnnotation({ type: 'error', title: 'Expectation Error' }, error.message)

    try {
      dumpProps(log, 17, error)
      dumpStack(log, error)
      if (error.diff) printDiff(log, error.diff)
    } finally {
      log.error('')
      log.leave()
    }

  // Assertion errors are another kind of exception we support
  } else if (error instanceof AssertionError) {
    const [ message = 'Unknown Error', ...lines ] = error.message.split('\n')

    log.enter(ERROR, `${$gry('Assertion Error:')} ${$red(message)}`)
    githubAnnotation({ type: 'error', title: 'Assertion Error' }, message)

    try {
      dumpProps(log, 15, error)
      dumpStack(log, error)

      // If we print diffs from generic errors, we take over
      if (genericErrorDiffs) {
        // if this is a generated message ignore all extra lines
        if (! error.generatedMessage) for (const line of lines) log.error(' ', line)
        printDiff(log, diff(error.actual, error.expected))
      } else {
        // trim initial empty lines
        while (lines.length && (! lines[0])) lines.shift()
        for (const line of lines) log.error(' ', line)
      }
    } finally {
      log.error('')
      log.leave()
    }

  // Any other error also gets printed somewhat nicely
  } else if (error instanceof Error) {
    const message = error.message || (error instanceof BuildFailure ? 'Build Failure' : 'Unknown Error')
    const string = Object.getPrototypeOf(error)?.constructor?.name || 'Error'

    // Chai calls its own assertion errors "AssertionError"
    const type =
        string === 'AssertionError' ? `${$gry('Assertion Error')}: ` :
        string === 'Error' ? '' : `${$gry(string)}: `

    log.enter(ERROR, `${type}${$red(message)}`)
    githubAnnotation({ type: 'error', title: string }, message)

    try {
      dumpProps(log, type.length, error)
      dumpStack(log, error)

      // if there are "actual" or "expected" properties on the error, diff!
      if (genericErrorDiffs && (('actual' in error) || ('expected' in error))) {
        printDiff(log, diff((error as any).actual, (error as any).expected))
      }
    } finally {
      log.error('')
      log.leave()
    }

  // Anthing else just gets dumped out...
  } else /* coverage ignore next */ {
    // This should never happen, as executor converts evertything to errors...
    log.error($gry('Uknown error:'), error)
  }
}

function dumpProps(log: Logger, pad: number, error: Error): void {
  Object.keys(error)
      .filter((k) => ![
        'diff', // expectations error,
        'actual', // assertion error, chai
        'expected', // assertion error, chai,
        'generatedMessage', // assertion error,
        'message', // error
        'showDiff', // chai
        'stack', // error
      ].includes(k))
      .filter((k) => !(error[k as keyof typeof error] === null))
      .filter((k) => !(error[k as keyof typeof error] === undefined))
      .forEach((k) => {
        const value = error[k as keyof typeof error]
        if ((k === 'code') && (value === 'ERR_ASSERTION')) return
        const details = typeof value === 'string' ? value : stringifyValue(value)
        log.error($gry(`${k}:`.padStart(pad - 1)), $ylw(details))
      })
}

function dumpStack(log: Logger, error: Error): void {
  if (! error.stack) return log.error('<no stack trace>')
  error.stack
      .split('\n')
      .filter((line) => line.match(/^\s+at\s+/))
      .map((line) => line.trim())
      .forEach((line) => log.error(line))
}
