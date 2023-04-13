// Reference ourselves, so that the constructor's parameters are correct
/// <reference path="./index.ts"/>

import { AssertionError } from 'node:assert'

import { BuildFailure } from '@plugjs/plug'
import { $blu, $grn, $gry, $ms, $red, $wht, $ylw, ERROR, NOTICE, WARN } from '@plugjs/plug/logging'

import { skip, Suite } from './execution/executable'
import { runSuite } from './execution/executor'
import * as setup from './execution/setup'
import { expect } from './expectation/expect'
import { ExpectationError } from './expectation/types'

import type { Files } from '@plugjs/plug/files'
import type { Logger } from '@plugjs/plug/logging'
import type { Context, PipeParameters, Plug } from '@plugjs/plug/pipe'
import type { Diff } from './expectation/diff'
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
    const { globals = true } = this._options
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
    }

    // Create our _root_ Suite
    const suite = new Suite(undefined, '', async () => {
      for (const file of files.absolutePaths()) await import(file)
    })

    // Run our suite and setup listeners
    const execution = runSuite(suite)

    execution.on('suite:start', (current) => {
      if (current.parent === suite) {
        context.log.notice('')
        context.log.enter(NOTICE, `${$wht(current.name)}`)
      } else if (current.parent) {
        context.log.enter(NOTICE, `${$blu(_details)} ${$wht(current.name)}`)
      } else {
        const snum = current.specs
        const fnum = files.length
        const smsg = snum === 1 ? 'spec' : 'specs'
        const fmsg = fnum === 1 ? 'file' : 'files'
        context.log.enter(NOTICE, `Running ${$ylw(snum)} ${smsg} from ${$ylw(fnum)} ${fmsg}`)
      }
    })

    execution.on('suite:done', () => {
      context.log.leave()
    })

    execution.on('spec:start', (spec) => {
      context.log.enter(NOTICE, `${$blu(_pending)} ${spec.name}`)
    })

    execution.on('spec:skip', (spec, ms) => {
      context.log.leave(WARN, `${$ylw(_pending)} ${spec.name} ${$ms(ms)} ${$gry('[')}${$ylw('skipped')}${$gry(']')}`)
    })

    execution.on('spec:pass', (spec, ms) => {
      context.log.leave(NOTICE, `${$grn(_success)} ${spec.name} ${$ms(ms)}`)
    })

    execution.on('spec:fail', (spec, ms, { number }) => {
      context.log.leave(ERROR,
          `${$red(_failure)} ${spec.name} ${$ms(ms)} ` +
          `${$gry('[')}${$red('failed')}${$gry('|')}${$red(`${number}`)}${$gry(']')}`)
    })

    execution.on('hook:fail', (hook, ms, { number }) => {
      context.log.error(ERROR,
          `${$red(_failure)} Hook "${hook.name}" ${$ms(ms)} ` +
          `${$gry('[')}${$red('failed')}${$gry('|')}${$red(`${number}`)}${$gry(']')}`)
    })

    // Await execution
    const { failed, passed, skipped, failures, time } = await execution.result

    // Dump all failures
    for (const { source, error, number } of failures) {
      const names: string[] = [ '' ]
      for (let p = source.parent; p?.parent; p = p.parent) {
        if (p) names.unshift(p.name)
      }
      const details = names.join(` ${$gry(_details)} `) + $wht(source.name)

      context.log.notice('')
      context.log.enter(ERROR, `${$gry('[')}${$red(number)}${$gry(']:')} ${details}`)
      dumpError(context.log, error)
      context.log.leave()
    }

    // Epilogue
    const snum = suite.specs
    const fnum = files.length
    const smsg = snum === 1 ? 'spec' : 'specs'
    const fmsg = fnum === 1 ? 'file' : 'files'

    const summary: string[] = []
    if (failed) summary.push(`${failed} ${$gry('failed')}`)
    if (skipped) summary.push(`${skipped} ${$gry('skipped')}`)
    if (passed) summary.push(`${passed} ${$gry('passed')}`)

    const epilogue = summary.length ? ` ${$gry('(')}${summary.join($gry(', '))}${$gry(')')}` : ''
    const message = `Ran ${$ylw(snum)} ${smsg} from ${$ylw(fnum)} ${fmsg}${epilogue} ${$ms(time)}`

    if (failed) {
      context.log.error('')
      context.log.error(message)
      throw new BuildFailure(`${failed} specs failed`)
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
 * ERROR REPORTING                                                            *
 * ========================================================================== */

function dumpError(log: Logger, error: any): void {
  if (error instanceof AssertionError) {
    const [ message = 'Unknown Error', ...lines ] = error.message.split('\n')
    log.enter(ERROR, `${$gry('Assertion Error:')} ${$red(message)}`)
    dumpStack(log, error)
    while (lines.length && (! lines[0])) lines.shift()
    for (const line of lines) log.error(' ', line)
    log.leave()
    return
  }

  if (error instanceof ExpectationError) {
    log.enter(ERROR, `${$gry('Expectation Error:')} ${$red(error.message)}`)
    dumpStack(log, error)
    if (error.diff) {
      log.error(`  ${$wht('Differences')} ${$gry('(')}${$red('actual')}${$gry('/')}${$grn('expected')}${$gry('/')}${$ylw('errors')}${$gry(')')}:`)
    }
    log.leave()
    return
  }

  log.error(error)
}

function dumpStack(log: Logger, error: Error): void {
  (error.stack || '')
      .split('\n')
      .filter((line) => line.match(/^\s+at\s+/))
      .map((line) => line.trim())
      .forEach((line) => log.error(line))
}
