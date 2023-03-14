// Reference ourselves, so that the constructor's parameters are correct
/// <reference path="./index.ts"/>

import { assert, BuildFailure } from '@plugjs/plug/asserts'
import { $p } from '@plugjs/plug/logging'
import { resolveFile } from '@plugjs/plug/paths'

import { boot } from './boot'
import { Reporter } from './reporter'

import type { Files } from '@plugjs/plug/files'
import type { Context, PipeParameters, Plug } from '@plugjs/plug/pipe'
import type { JasmineOptions } from './index'

/** Writes some info about the current {@link Files} being passed around. */
export class Jasmine implements Plug<void> {
  constructor(...args: PipeParameters<'jasmine'>)
  constructor(private readonly _options: JasmineOptions = {}) {}

  async pipe(files: Files, context: Context): Promise<void> {
    const jasmine = boot()

    // HACK: capture calls to "buildExpectationResult" to inject the original
    // error into the expectation result that will be given to our reporter...
    const buildExpectationResult = (<any> jasmine).buildExpectationResult
    ;(<any> jasmine).buildExpectationResult = function(...args: any): any {
      const ret = buildExpectationResult.apply(this, args)
      if (ret && (args[0].error instanceof Error)) ret['originalError'] = args[0].error
      return ret
    }

    // Destructure our options and ignore `coverageDir`
    const { setup, showDiff = true, showStack = true, ...options } = this._options
    delete options.coverageDir

    // Configure the Jasmine environment
    const env = jasmine.getEnv()
    env.configure(Object.assign({
      random: false,
      stopOnSpecFailure: false,
      failSpecWithNoExpectations: false,
      stopSpecOnExpectationFailure: true,
    }, options))

    // Setup our reporter
    env.addReporter(new Reporter(context.log, showDiff, showStack))

    // See if we require a setup script...
    if (setup) {
      const requiredFile = context.resolve(setup)
      const scriptFile = resolveFile(requiredFile)
      assert(scriptFile, `Jasmine setup script ${$p(requiredFile)} not found`)
      context.log.debug(`Importing setup script ${$p(requiredFile)}`)
      await import(scriptFile)
    }

    // Load up all our spec files...
    for (const specFile of files.absolutePaths()) {
      context.log.debug(`Importing spec ${$p(specFile)}`)
      await import(specFile)
    }

    // Run Jasmine and await for its result
    const result = await env.execute()

    // Check the result and fail if needed
    if (result.overallStatus === 'passed') {
      context.log.notice('')
    } else if (result.overallStatus === 'incomplete') {
      context.log.error('')
      context.log.error(result.incompleteReason)
      throw BuildFailure.fail()
    } else {
      context.log.error('')
      throw BuildFailure.fail()
    }
  }
}
