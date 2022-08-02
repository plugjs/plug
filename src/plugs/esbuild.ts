/// <reference path="../../types/webassembly.d.ts" />

import { assert, fail } from '../assert'
import { build, BuildOptions } from 'esbuild'
import { Files, FilesBuilder } from '../files'
import { $p, log } from '../log'

import { resolveAbsolutePath } from '../paths'
import { install, Plug } from '../pipe'
import { Run } from '../run'

export type ESBuildOptions = Omit<BuildOptions, 'absWorkingDir' | 'entryPoints' | 'watch'>

export class ESBuild implements Plug {
  #options: ESBuildOptions

  constructor(options: ESBuildOptions) {
    this.#options = options
  }

  async pipe(_files: Files, run: Run): Promise<Files> {
    const entryPoints = [ ..._files ]
    const absWorkingDir = _files.directory

    const options: BuildOptions = {
      /* Defaults */
      platform: 'node',
      target: `node${process.versions['node']}`,
      format: 'cjs',
      outbase: absWorkingDir,

      logLevel: 'silent',

      /* Our options */
      ...this.#options,

      /* Always override */
      absWorkingDir,
      entryPoints,
    }

    /* Sanity check on output file/directory */
    assert(!(options.outdir && options.outfile), 'Options "outfile" and "outdir" can not coexist')
    assert(!(options.watch), 'Option "watch" can not work in plugs')

    /* Where to write, where to write? */
    let builder: FilesBuilder
    if (options.bundle && options.outfile && (entryPoints.length === 1)) {
      builder = run.files(absWorkingDir)
      const outputFile = resolveAbsolutePath(absWorkingDir, options.outfile)
      const entryPoint = resolveAbsolutePath(absWorkingDir, entryPoints[0])
      options.outfile = outputFile

      log.debug('Bundling', $p(entryPoint), 'into', $p(outputFile))
    } else {
      assert(options.outdir, 'Option "outdir" must be specified')

      builder = run.files(options.outdir)
      options.outdir = builder.directory

      const message = options.bundle ? 'Bundling' : 'Transpiling'
      log.debug(message, entryPoints.length, 'files to', $p(builder.directory))
    }

    log.trace('Running ESBuild', options)
    const esbuild = await build({ ...options, metafile: true })
    log.trace('ESBuild Results', esbuild)

    for (const warning of esbuild.warnings) {
      const { id, text, ...details } = warning
      log.warn(`${text} [${id}]`, details)
    }

    for (const error of esbuild.errors) {
      const { id, text, ...details } = error
      log.error(`${text} [${id}]`, details)
    }

    if (esbuild.errors.length) {
      fail('ESBuild encountered', esbuild.errors.length, 'errors')
    }

    const outputs = esbuild.metafile.outputs
    for (const file in outputs) {
      const source = resolveAbsolutePath(absWorkingDir, outputs[file].entryPoint!)
      const target = resolveAbsolutePath(absWorkingDir, file)
      log.debug('Transpiled', $p(source), 'to', $p(target))
      builder.add(target)
    }

    const result = builder.build()
    log.info('ESBuild produced', result.length, 'files into', $p(result.directory))
    return result
  }
}

export const esbuild = install('esbuild', ESBuild)

declare module '../pipe' {
  export interface Pipe {
    esbuild: PipeExtension<typeof ESBuild>
  }
}
