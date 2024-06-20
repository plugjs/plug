import { basename } from 'node:path'

import { build } from 'esbuild'

import { assert } from '../asserts'
import { Files } from '../files'
import { readFile } from '../fs'
import { $p, ERROR, WARN } from '../logging'
import { getAbsoluteParent, resolveAbsolutePath } from '../paths'
import { install } from '../pipe'

import type { BuildFailure, BuildOptions, BuildResult, Format, Message, Metafile } from 'esbuild'
import type { FilesBuilder } from '../files'
import type { Logger, ReportLevel, ReportRecord } from '../logging'
import type { AbsolutePath } from '../paths'
import type { Context, PipeParameters, Plug } from '../pipe'

export type ESBuildOptions = Omit<BuildOptions, 'absWorkingDir' | 'entryPoints' | 'watch'>

export * from './esbuild/bundle-locals'
export * from './esbuild/fix-extensions'

/*
 * Type definition for `WebAssembly`. This is normally provided to TypeScript
 * by `lib.dom.d.ts`, and is not defined by Node's own types.
 *
 * https://github.com/evanw/esbuild/issues/2388
 */
// eslint-disable-next-line @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars
declare namespace WebAssembly {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Module {} // just define an empty interface...
}

declare module '../index' {
  export interface Pipe {
    /**
     * Transpile and bundle with {@link https://esbuild.github.io/ esbuild}.
     *
     * For documentation on the _options_ to pass to _esbuild_ refer to its
     * {@link https://esbuild.github.io/api/#build-api documentation}.
     *
     * @param options Build {@link ESBuildOptions | options} to pass to esbuild.
     *
     */
    esbuild(options: ESBuildOptions): Pipe
  }
}

/* ========================================================================== *
 * INSTALLATION / IMPLEMENTATION                                              *
 * ========================================================================== */

install('esbuild', class ESBuild implements Plug<Files> {
  constructor(...args: PipeParameters<'esbuild'>)
  constructor(private readonly _options: ESBuildOptions) {}

  async pipe(files: Files, context: Context): Promise<Files> {
    const entryPoints = [ ...files ]
    const absWorkingDir = files.directory

    const options: BuildOptions = {
      /* Default our platform/target to NodeJS, current major version */
      platform: 'node',
      target: `node${process.versions['node'].split('.')[0]}`,

      /* The default format (if not specified in options) is from package.json */
      format: this._options.format || await _moduleFormat(files.directory, context.log),

      /* Output bese directory */
      outbase: absWorkingDir,

      /* Merge in the caller's options */
      ...this._options,

      /* Always override */
      absWorkingDir,
      entryPoints,
      logLevel: 'silent',
    }

    if (options.format === 'cjs') {
      options.define = Object.assign({ __fileurl: '__filename' }, options.define)
    } else if (options.format === 'esm') {
      options.define = Object.assign({ __fileurl: 'import.meta.url' }, options.define)
    }

    /* Sanity check on output file/directory */
    assert(!(options.outdir && options.outfile), 'Options "outfile" and "outdir" can not coexist')

    /* Where to write, where to write? */
    let builder: FilesBuilder
    if (options.bundle && options.outfile && (entryPoints.length === 1)) {
      builder = Files.builder(absWorkingDir)
      const outputFile = resolveAbsolutePath(absWorkingDir, options.outfile)
      const entryPoint = resolveAbsolutePath(absWorkingDir, entryPoints[0]!)
      options.outfile = outputFile

      context.log.debug('Bundling', $p(entryPoint), 'into', $p(outputFile))
    } else {
      assert(options.outdir, 'Option "outdir" must be specified')

      builder = Files.builder(context.resolve(options.outdir))
      options.outdir = builder.directory

      const message = options.bundle ? 'Bundling' : 'Transpiling'
      context.log.debug(message, entryPoints.length, 'files to', $p(builder.directory))
    }

    const report = context.log.report('ESBuild Report')

    context.log.trace('Running ESBuild', options)
    let esbuild: undefined | (BuildResult & { metafile: Metafile })
    try {
      esbuild = await build({ ...options, metafile: true })
      context.log.trace('ESBuild Results', esbuild)

      report.add(...esbuild.warnings.map((m) => convertMessage(WARN, m, absWorkingDir)))
      report.add(...esbuild.errors.map((m) => convertMessage(ERROR, m, absWorkingDir)))
    } catch (error: any) {
      const e = error as BuildFailure
      if (e.warnings) report.add(...e.warnings.map((m) => convertMessage(WARN, m, absWorkingDir)))
      if (e.errors) report.add(...e.errors.map((m) => convertMessage(ERROR, m, absWorkingDir)))
    }

    await report.loadSources()
    report.done()

    assert(esbuild, 'ESBuild did not produce any result')

    for (const file in esbuild.metafile.outputs) {
      builder.add(resolveAbsolutePath(absWorkingDir, file))
    }

    const result = builder.build()
    context.log.info('ESBuild produced', result.length, 'files into', $p(result.directory))
    return result
  }
})

function convertMessage(level: ReportLevel, message: Message, directory: AbsolutePath): ReportRecord {
  const record: ReportRecord = { level, message: message.text }
  record.tags = [ message.id, message.pluginName ].filter((tag) => !! tag)

  if (message.location) {
    record.line = message.location.line
    record.column = message.location.column + 1
    record.length = message.location.length
    record.file = resolveAbsolutePath(directory, message.location.file)
  }

  return record
}

/* ========================================================================== *
 * DEFAULT MODULE FORMAT FROM PACKAGE.JSON                                    *
 * ========================================================================== */

/** Cache for directory to module format as discovered in "package.json" */
const _moduleFormatCache = new Map<AbsolutePath, Format>()

/**
 * Figures out the _default_ module type for a directory, looking into the
 * `package.json`'s `type` field (either `commonjs` or `module`)
 */
async function _moduleFormat(directory: AbsolutePath, log: Logger): Promise<Format> {
  /* Before doing anything else, check our cache */
  const type = _moduleFormatCache.get(directory)
  if (type) return type

  /* Try to read the "package.json" file from this directory */
  const file = resolveAbsolutePath(directory, 'package.json')

  try {
    const json = await readFile(file, 'utf-8')
    const data = JSON.parse(json)

    /* Be liberal in what you accept? Default to CommonJS if none found */
    const type = data.type === 'module' ? 'esm' : 'cjs'
    log.debug(`File "${file}" defines module type as "${data.type}" (${type})`)
    _moduleFormatCache.set(directory, type)
    return type
  } catch (cause: any) {
    /* We _accept_ a couple of errors, file not found, or file is directory */
    if ((cause.code !== 'ENOENT') && (cause.code !== 'EISDIR')) throw cause
  }

  /*
   * We couldn't find "package.json" in this directory, go up if we can!
   *
   * That said, if we are at a directory called "node_modules" we stop here,
   * as we don't want to inherit the default type from an _importing_ package,
   * into the _imported_ one...
   */
  const name = basename(directory)
  const parent = getAbsoluteParent(directory)

  if ((name === 'node_modules') || (parent === directory)) {
    _moduleFormatCache.set(directory, 'cjs') // default
    return 'cjs'
  } else {
    /* We also cache back, on the way up */
    const type = await _moduleFormat(parent, log)
    _moduleFormatCache.set(directory, type)
    return type
  }
}
