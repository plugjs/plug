import type { Files, FilesBuilder } from '../files'
import type { Run } from '../run'

import { build, BuildFailure, BuildOptions, BuildResult, Message, Metafile } from 'esbuild'
import { assert } from '../assert'
import { $p, ReportRecord } from '../log'
import { AbsolutePath, resolveAbsolutePath } from '../paths'
import { install, Plug } from '../pipe'

export type ESBuildOptions = Omit<BuildOptions, 'absWorkingDir' | 'entryPoints' | 'watch'>

/**
 * Transpile and bundle files with {@link https://esbuild.github.io/ | esbuild}.
 */
export class ESBuild implements Plug<Files> {
  constructor(options: ESBuildOptions)
  constructor(private readonly _options: ESBuildOptions) {}

  async pipe(files: Files, run: Run): Promise<Files> {
    const entryPoints = [ ...files ]
    const absWorkingDir = files.directory

    const options: BuildOptions = {
      /* Defaults */
      platform: 'node',
      target: `node${process.versions['node']}`,
      format: 'cjs',
      outbase: absWorkingDir,

      logLevel: 'silent',

      /* Our options */
      ...this._options,

      /* Always override */
      absWorkingDir,
      entryPoints,
      watch: false,
    }

    /* Sanity check on output file/directory */
    assert(!(options.outdir && options.outfile), 'Options "outfile" and "outdir" can not coexist')

    /* Where to write, where to write? */
    let builder: FilesBuilder
    if (options.bundle && options.outfile && (entryPoints.length === 1)) {
      builder = run.files(absWorkingDir)
      const outputFile = resolveAbsolutePath(absWorkingDir, options.outfile)
      const entryPoint = resolveAbsolutePath(absWorkingDir, entryPoints[0])
      options.outfile = outputFile

      run.log.debug('Bundling', $p(entryPoint), 'into', $p(outputFile))
    } else {
      assert(options.outdir, 'Option "outdir" must be specified')

      builder = run.files(options.outdir)
      options.outdir = builder.directory

      const message = options.bundle ? 'Bundling' : 'Transpiling'
      run.log.debug(message, entryPoints.length, 'files to', $p(builder.directory))
    }

    const report = run.report('ESBuild Report')

    run.log.trace('Running ESBuild', options)
    let esbuild: undefined | (BuildResult & { metafile: Metafile })
    try {
      esbuild = await build({ ...options, metafile: true })
      run.log.trace('ESBuild Results', esbuild)

      report.add(...esbuild.warnings.map((m) => convertMessage('WARN', m, absWorkingDir)))
      report.add(...esbuild.errors.map((m) => convertMessage('ERROR', m, absWorkingDir)))
    } catch (error: any) {
      const e = error as BuildFailure
      if (e.warnings) report.add(...e.warnings.map((m) => convertMessage('WARN', m, absWorkingDir)))
      if (e.errors) report.add(...e.errors.map((m) => convertMessage('ERROR', m, absWorkingDir)))
    }

    await report.loadSources()
    if (! report.empty) report.emit(true)
    if (report.errors) report.fail()

    assert(esbuild, 'ESBuild did not produce any result')

    for (const file in esbuild.metafile.outputs) {
      builder.add(resolveAbsolutePath(absWorkingDir, file))
    }

    const result = builder.build()
    run.log.info('ESBuild produced', result.length, 'files into', $p(result.directory))
    return result
  }
}

function convertMessage(level: 'ERROR' | 'WARN', message: Message, directory: AbsolutePath): ReportRecord {
  const record: ReportRecord = { level, message: message.text }
  record.tags = [ message.id, message.pluginName ].filter((tag) => !! tag)

  if (message.location) {
    record.line = message.location.line,
    record.column = message.location.column + 1
    record.length = message.location.length
    record.file = resolveAbsolutePath(directory, message.location.file)
  }

  return record
}

/* ========================================================================== *
 * INSTALLATION                                                               *
 * ========================================================================== */

install('esbuild', ESBuild)

declare module '../pipe' {
  export interface Pipe {
    /**
     * Transpile and bundle files with {@link https://esbuild.github.io/ esbuild}.
     */
    esbuild: PipeExtension<typeof ESBuild>
  }
}

/* ========================================================================== *
 * PLUGINS                                                                    *
 * ========================================================================== */

export * from './esbuild/bundle-locals'
export * from './esbuild/fix-extensions'
export * from './esbuild/check-dependencies'
