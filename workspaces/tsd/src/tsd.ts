// Reference ourselves, so that the constructor's parameters are correct
/// <reference path="./index.ts" />

import { resolve, Files } from '@plugjs/plug'
import { assertRelativeChildPath, getCurrentWorkingDirectory, resolveAbsolutePath } from '@plugjs/plug/paths'
import tsd from 'tsd'
import { ERROR, NOTICE, WARN } from '@plugjs/plug/logging'

import type { Context, PipeParameters, Plug } from '@plugjs/plug/pipe'
import type { TsdOptions } from './index'


/** Writes some info about the current {@link Files} being passed around. */
export class Tsd implements Plug<void> {
  constructor(...args: PipeParameters<'tsd'>)
  constructor(private readonly _options: TsdOptions = {}) {}

  async pipe(files: Files, context: Context): Promise<void> {
    const { cwd: _cwd, typingsFile: _typingsFile } = this._options

    // Resolve the absolute directory, and optionally the typings file relative to it
    const cwd = _cwd ? resolve(_cwd) : getCurrentWorkingDirectory()
    const typingsFile = _typingsFile && assertRelativeChildPath(cwd, resolve(_typingsFile))

    // Convert incoming files, relativizing them to the `cwd` specified in options
    const testFiles = [ ...Files.builder(cwd).add(...files.absolutePaths()).build() ]
    void files, context, this._options

    // Let TSD do its thing
    const diagnostics = await tsd({
      cwd,
      typingsFile,
      testFiles,
    })

    // Prepare a report out of the diagnostics
    const report = context.log.report('Typescript Definitions Test')
    for (const diag of diagnostics) {
      const { fileName, column, line, message, severity } = diag
      const file = resolveAbsolutePath(cwd, fileName)
      const level = severity === 'warning' ? WARN : ERROR

      if ((level === WARN) && (/__file_marker__/gm.test(message))) {
        report.annotate(NOTICE, file, 'mark')
      } else {
        report.add({ line, column, file, message, level })
      }
    }

    // Load up sources and report!
    await report.loadSources()
    report.done(true)
  }
}
