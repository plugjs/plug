// Reference ourselves, so that the constructor's parameters are correct
/// <reference path="./index.ts"/>

import { $blu, $grn, $gry, $ms, $red, $wht, $ylw, ERROR, NOTICE, WARN } from '@plugjs/plug/logging'

import { runSuite } from './execution/executor'
import { Suite, skip } from './execution/executable'
import { expect } from './expectation/expect'
import * as setup from './execution/setup'

import type { Files } from '@plugjs/plug/files'
import type { Context, PipeParameters, Plug } from '@plugjs/plug/pipe'
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
    await suite.setup()
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
        const smsg = snum > 1 ? 'specs' : 'spec'
        const fmsg = fnum > 1 ? 'files' : 'file'
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
      context.log.leave(WARN, `${$ylw(_pending)} ${spec.name} ${$ms(ms)}`)
    })

    execution.on('spec:pass', (spec, ms) => {
      context.log.leave(NOTICE, `${$grn(_success)} ${spec.name} ${$ms(ms)}`)
    })

    execution.on('spec:fail', (spec, ms, failure) => {
      context.log.error(failure) // TODO
      context.log.leave(ERROR, `${$red(_failure)} ${spec.name} ${$ms(ms)}`)
    })

    // Await execution
    const result = await execution.result
    void result, context
  }
}
