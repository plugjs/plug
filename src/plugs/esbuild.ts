import assert from 'assert'
import path from 'path'

import { $p, fail, log } from '../log'
import { build, BuildOptions } from 'esbuild'
import { Files, FilesBuilder } from '../files'

import type { Plug } from '../pipe'
import type { Run } from '../run'

export type ESBuildOptions = Omit<BuildOptions, 'absWorkingDir' | 'entryPoints' | 'watch'>

export class ESBuild implements Plug {
  #options: ESBuildOptions

  constructor(options: ESBuildOptions) {
    this.#options = options
  }

  async pipe(run: Run, _files: Files): Promise<Files> {
    const entryPoints = [ ..._files ]
    const absWorkingDir = _files.directory

    const options: BuildOptions = {
      /* Defaults */
      platform: 'node',
      target: `node${process.versions['node']}`,
      format: 'cjs',
      outbase: absWorkingDir,

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

      builder = Files.builder(run, absWorkingDir)
      options.outfile = path.resolve(absWorkingDir, options.outfile)

      log.debug('Bundling', $p(entryPoints[0]), 'into', $p(options.outfile))
    } else {
      assert(options.outdir, 'Option "outdir" must be specified')

      builder = Files.builder(run, options.outdir)
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
      const source = path.resolve(absWorkingDir, outputs[file].entryPoint!)
      const target = path.resolve(absWorkingDir, file)
      log.trace('Transpiled', $p(source), 'to', $p(target))
      builder.add(target)
    }

    const result = builder.build()
    log.info('ESBuild produced', result.length, 'files into', $p(result.directory))
    return result
  }
}

export function esbuild(options: ESBuildOptions) {
  return new ESBuild(options)
}
