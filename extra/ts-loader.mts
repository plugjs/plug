/* ========================================================================== *
 * HACK BEYOND REDEMPTION: TRANSPILE .ts FILES (the esm loader)               *
 * -------------------------------------------------------------------------- *
 * This relies on the Node's `--experimental-loader` feature, and uses        *
 * ESBuild build magic to quickly transpile TypeScript files into JavaScript. *
 *                                                                            *
 * The plan as it stands is as follows:                                       *
 * - `.mts` files always get transpiled to ESM modules                        *
 * - `.cts` files always get transpiled to CJS modules                        *
 * - `.ts` files are treanspiled according to what's in `package.json`        *
 *                                                                            *
 * Additionally, when transpiling to ESM modules, we can't rely on the magic  *
 * that Node's `require(...)` call uses to figure out which file to import.   *
 * We need to _actually veryfy_ on disk what's the correct file to import.    *
 *                                                                            *
 * This is a single module, only available as ESM, and it will _both_ behave  *
 * as a NodeJS' loader, _and_ inject the CJS extension handlers (hack) found  *
 * in `node:module` 's `_extensions` (same as `require.extensions`).          *
 * ========================================================================== */

import _esbuild from 'esbuild'

import _fs from 'node:fs'
import _module from 'node:module'
import _path from 'node:path'
import _url from 'node:url'
import _workers from 'node:worker_threads'


/* ========================================================================== *
 * DEBUGGING AND ERRORS                                                       *
 * ========================================================================== */

/** Flag indicating whether to debug or not (checks `DEBUG_TS_LOADER`) */
const _debug = process.env.DEBUG_TS_LOADER === 'true'

/** Emit some logs if `DEBUG_TS_LOADER` is set to `true` */
function _log(type: 'cjs' | 'esm' | '---', ...args: string []): void {
  if (! _debug) return

  const thread = _workers.isMainThread ? 'main' : _workers.threadId
  const prefix = `[ts-loader|${type}|pid=${process.pid}|tid=${thread}]`

  // eslint-disable-next-line no-console
  console.log(prefix, ...args)
}

/** Fail miserably */
function _throw(message: string, options: { start?: Function, code?: string, cause?: any } = {}): never {
  const thread = _workers.isMainThread ? 'main' : _workers.threadId
  const prefix = `[ts-loader|pid=${process.pid}|tid=${thread}]`

  const { start = _throw, ...extra } = options
  const error = new Error(`${prefix} ${message}`)
  Error.captureStackTrace(error, start)
  Object.assign(error, extra)

  throw error
}


/* ========================================================================== *
 * FILES AND DISCOVERY                                                        *
 * ========================================================================== */

/* Returns the _extension_ of a file/url only if it ends in `.ts`, `.mts` or `.cts` */
function _tsExt(specifier: string): '.ts' | '.cts' | '.mts' | undefined {
  const match = specifier.match(/\.[mc]?ts$/)
  if (match) return match[0] as '.ts' | '.cts' | '.mts'
  return undefined
}

const _moduleFormatCache = new Map<string, 'commonjs' | 'module'>()

/*
 * Figures out the _default_ module type for a directory, looking into the
 * `package.json`'s `type` field (either `commonjs` or `module`)
 */
function _moduleFormat(directory: string): 'commonjs' | 'module' {
  /* Before doing anything else, check our cache */
  const type = _moduleFormatCache.get(directory)
  if (type) return type

  /* Try to read the "package.json" file from this directory */
  const file = _path.resolve(directory, 'package.json')

  try {
    const json = _fs.readFileSync(file, 'utf-8')
    const data = JSON.parse(json)

    /* Be liberal in what you accept? Default to CommonJS if none found */
    const type = data.type === 'module' ? 'module' : 'commonjs'
    _log('---', `File "${file}" defines module type as "${type}"`)
    _moduleFormatCache.set(directory, type)
    return type
  } catch (cause: any) {
    /* We _accept_ a couple of errors, file not found, or file is directory */
    if ((cause.code !== 'ENOENT') && (cause.code !== 'EISDIR')) {
      _throw(`Unable to read or parse "${file}"`, { cause })
    }
  }

  /*
   * We couldn't find "package.json" in this directory, go up if we can!
   *
   * That said, if we are at a directory called "node_modules" we stop here,
   * as we don't want to inherit the default type from an _importing_ package,
   * into the _imported_ one...
   */
  const name = _path.basename(directory)
  const parent = _path.dirname(directory)

  if ((name === 'node_modules') || (parent === directory)) {
    _moduleFormatCache.set(directory, 'commonjs') // default
    return 'commonjs'
  } else {
    /* We also cache back, on the way up */
    const type = _moduleFormat(parent)
    _moduleFormatCache.set(directory, type)
    return type
  }
}

/* Returns a boolean indicating whether the specified file exists or not */
function _isFile(path: string): boolean {
  try {
    return _fs.statSync(path).isFile()
  } catch (error) {
    return false
  }
}

/* Returns a boolean indicating whether the specified file exists or not */
function _isDirectory(path: string): boolean {
  try {
    return _fs.statSync(path).isDirectory()
  } catch (error) {
    return false
  }
}

/* ========================================================================== *
 * ESBUILD HELPERS                                                            *
 * ========================================================================== */

/**
 * Take an ESBuild `BuildResult` or `BuildFailure` (they both have arrays
 * of `Message` in both `warnings` and `errors`), format them and print them
 * out nicely. Then fail if any error was detected.
 */
function _esbReport(
    filename: string,
    what: _esbuild.BuildFailure | _esbuild.BuildResult,
): void {
  const { warnings = [], errors = [] } = what

  const output = process.stderr
  const options = { color: !!output.isTTY, terminalWidth: output.columns || 80 }

  const messages = [
    ..._esbuild.formatMessagesSync(warnings, { kind: 'warning', ...options }),
    ..._esbuild.formatMessagesSync(errors, { kind: 'error', ...options }),
  ]

  messages.forEach((message) => output.write(`${message}\n`))

  if (errors.length) {
    _throw(`[ts-loader] ESBuild found ${errors.length} errors in "${filename}"`)
  }
}

/**
 * Return the _code_ produced by ESBuild (as a string) for the given file name
 * or fail miserable if that was not produced
 */
function _esbResult(
    filename: string,
    result?: _esbuild.BuildResult,
): string {
  if (! result) _throw(`No result returned by ESBuild for ${filename}`)
  if (! result.outputFiles) _throw(`No output files produced by ESBuild for ${filename}`)

  for (const output of result.outputFiles) {
    if (output.path === filename) return output.text
  }

  _throw(`ESBuild produced no output for "${filename}"`)
}

/*
 * ESBuild plugin to discover files to be imported from `import` statements */
const _addImportExtension: _esbuild.Plugin = {
  name: 'ts-loader',
  setup(build) {
    const _extensions = build.initialOptions.resolveExtensions || []
    if (! _extensions.length) {
      _log('---', 'No resolve extensions supplied to ESBuild')
      return
    }

    build.onResolve({ filter: /.*/ }, (args) => {
      /* If this is the "root" file (it has no importer) return it unchanged */
      if (! args.importer) return { external: false }
      /* If the import does not start with './' or '../' then it's not ours */
      if (! args.path.match(/^\.\.?\//)) return { external: true }

      /* The directory  to resolve against is the directory of the importer */
      const directory = _path.dirname(args.importer)
      const resolved = _path.resolve(directory, args.path)

      _log('---', `Importing "${args.path}" in "${args.importer}"`)

      /* If the file exists as-is, then just import it as-is */
      if (_isFile(resolved)) {
        _log('---', `|   found "${args.path}" as "${resolved}"`)
        return { external: true } // easy peasy :-)
      }

      /* Look for our various extensions, one-by-one */
      for (const ext of _extensions) {
        const newTarget = resolved + ext
        const newPath = args.path + ext
        if (_isFile(newTarget)) {
          _log('---', `|   found "${newPath}" as "${newTarget}"`)
          return { path: newPath, external: true }
        }
      }

      /* Second try: treat the argument as a directory, and use the index */
      if (_isDirectory(resolved)) {
        for (const ext of _extensions) {
          const index = 'index' + ext
          const newTarget = _path.resolve(resolved, index)
          const newPath = _path.join(args.path, index)
          if (_isFile(newTarget)) {
            _log('---', `|   found "${newPath}" as "${newTarget}"`)
            return { path: newPath, external: true }
          }
        }
      }

      /* We checked any possibility and found none... Give up! */
      _log('---', `|   wrong "${args.path}"`)
      return { external: true } // always "external"
    })
  },
}


/* ========================================================================== *
 * ESM VERSION                                                                *
 * ========================================================================== */

/** The formats that can be handled by NodeJS' loader */
type Format = 'builtin' | 'commonjs' | 'json' | 'module' | 'wasm'

/* ========================================================================== */

/** The type identifying a NodeJS' loader `resolve` hook. */
type ResolveHook = (
  /** Whatever was requested to be imported (module, relative file, ...). */
  specifier: string,
  /** Context information around this `resolve` hook call. */
  context: ResolveContext,
  /** The subsequent resolve hook in the chain, or the Node.js default one. */
  nextResolve: ResolveNext,
) => ResolveResult | Promise<ResolveResult>

/** Context information around a `resolve` hook call. */
interface ResolveContext {
  importAssertions: object
  /** Export conditions of the relevant `package.json`. */
  conditions: string[]
  /** The module importing this one, or undefined if this is the entry point. */
  parentURL?: string | undefined
}

/** The subsequent resolve hook in the chain, or the Node.js default one. */
type ResolveNext = (specifier: string, context: ResolveContext) => ResolveResult

/** A type describing the required results from a `resolve` hook */
interface ResolveResult {
  /** The absolute URL to which this input resolves. */
  url: string
  /** A format hint to the `load` hook (it might be ignored). */
  format?: Format | null | undefined
  /** A signal that this hook intends to terminate the chain of resolve hooks. */
  shortCircuit?: boolean | undefined
}

/* ========================================================================== */

/** The type identifying a NodeJS' loader `load` hook. */
type LoadHook = (
  /** The URL returned by the resolve chain. */
  url: string,
  /** Context information around this `load` hook call. */
  context: LoadContext,
  /** The subsequent load hook in the chain, or the Node.js default one. */
  nextLoad: LoadNext,
) => LoadResult | Promise<LoadResult>

/** Context information around a `load` hook call. */
interface LoadContext {
  importAssertions: object
  /** Export conditions of the relevant `package.json` */
  conditions: string[]
  /** The format hint from the `resolve` hook. */
  format?: ResolveResult['format']
}

/** The subsequent load hook in the chain, or the Node.js default one. */
type LoadNext = (url: string, context: LoadContext) => LoadResult

/** A type describing the required results from a `resolve` hook */
type LoadResult = {
  /** The format of the code being loaded. */
  format: Format
  /** A signal that this hook intends to terminate the chain of load hooks. */
  shortCircuit?: boolean | undefined
} & ({
  format: 'builtin' | 'commonjs'
  /** When the source is `builtin` or `commonjs` no source must be returned */
  source?: never | undefined
} | {
  format: 'json' | 'module'
  /** When the source is `json` or `module` the source can include strings */
  source: string | ArrayBuffer | NodeJS.TypedArray
} | {
  format: 'wasm'
  /** When the source is `wasm` the source must not be a string */
  source: ArrayBuffer | NodeJS.TypedArray
})

/* ========================================================================== */

/** Our main `resolve` hook */
export const resolve: ResolveHook = (specifier, context, nextResolve): ResolveResult => {
  if (! _tsExt(specifier)) return nextResolve(specifier, context)

  /* The parent URL is either from the context, or the process.cwd() value */
  const { parentURL = _url.pathToFileURL(`${process.cwd()}/`).href } = context

  /* The resolved URL is the specifier resolved against the parent */
  const url = new URL(specifier, parentURL).href

  /* Let's see what's going on */
  _log('esm', `Resolved URL: "${url}"`)
  _log('esm', `|  specifier: "${specifier}"`)
  _log('esm', `| parent URL: ${context.parentURL ? `"${context.parentURL}"` : ''}`)

  /* All done, short circuit the result */
  return { shortCircuit: true, url }
}


/** Our main `load` hook */
export const load: LoadHook = async (url, context, nextLoad): Promise<LoadResult> => {
  /* Figure our the extension... */
  const ext = _tsExt(url)

  /* Quick and easy bail-outs for non-TS or ".cts" (always `commonjs`) */
  if (! ext) return nextLoad(url, context)
  if (ext === '.cts') return { format: 'commonjs' }

  /* Convert the url into a file name, any error gets ignored */
  let filename = undefined
  try {
    filename = _url.fileURLToPath(url)
  } catch (error) {
    return nextLoad(url, context) // not a file: URL ? next!
  }

  /* We always operate relative to the file */
  const file = _path.basename(filename)
  const dir = _path.dirname(filename)

  /* If the file is a ".ts", we need to figure out the default type */
  if (ext === '.ts') {
    const format = _moduleFormat(dir)

    /* If the _default_ module type is 'commonjs' then load as such! */
    if (format === 'commonjs') return { format }
  }

  /* ESbuild options */
  const options: _esbuild.BuildOptions = {
    format: 'esm', // here we are transpiling as ESM
    entryPoints: [ file ], // relative file name
    absWorkingDir: dir, // directory where file lives
    outdir: dir, // output in the same directory
    sourcemap: 'inline', // always inline source maps
    sourcesContent: false, // do not include sources content in sourcemap
    platform: 'node', // d'oh! :-)
    target: `node${process.versions['node']}`, // target _this_ version
    outExtension: { '.js': '.ts' }, // keep the output file name
    allowOverwrite: true, // input and output file names are the same
    write: false, // we definitely _do not_ write this back to disk
    define: { // those are defined/documented in "./globals.ts"
      __fileurl: 'import.meta.url',
      __esm: 'true',
      __cjs: 'false',
    },
    // Make sure we _always_ have extensions in the "import" statements
    bundle: true, // trigger a "bundle" build to analyse imports one by one
    resolveExtensions: [ '.mts', '.ts', '.mjs', '.js' ], //
    plugins: [ _addImportExtension ], // our plugin adding extensions
  }

  /* Emit a line on the console when loading in debug mode */
  if (_debug) {
    options.banner = {
      // eslint-disable-next-line no-template-curly-in-string
      js: 'console.log(`[ts-loader|esm]: Loaded "${import.meta.url}"`);',
    }
  }

  /* Transpile our TypeScript file into some JavaScript stuff */
  let result
  try {
    result = await _esbuild.build(options)
  } catch (cause) {
    _esbReport(filename, cause as _esbuild.BuildFailure)
    // If the above doesn't fail (normal error?) then bail out
    _throw(`ESBuild error transpiling "${filename}"`, { cause })
  }

  /* Report out any warning or error and fail if there are errors */
  _esbReport(filename, result)

  /* Done, return our transpiled code */
  return {
    format: 'module',
    shortCircuit: true,
    source: _esbResult(filename, result),
  }
}


/* ========================================================================== *
 * CJS VERSION                                                                *
 * ========================================================================== */

/** The extension handler type, loading CJS modules */
type ExtensionHandler = (module: NodeJS.Module, filename: string) => void

/* Add the `_compile(...)` method to NodeJS' `Module` interface */
declare global {
  namespace NodeJS {
    interface Module {
      _compile: (contents: string, filename: string) => void
    }
  }
}

/** Add the `_extensions[...]` member of `node:module`. */
declare module 'node:module' {
  const _extensions: Record<`.${string}`, ExtensionHandler>
}

/* ========================================================================== */

const loader: ExtensionHandler = (module, filename): void => {
  _log('cjs', `Transpiling "${filename}"`)

  /* We always operate relative to the file */
  const file = _path.basename(filename)
  const dir = _path.dirname(filename)

  /* ESbuild options */
  const options: _esbuild.BuildOptions = {
    format: 'cjs', // here we are transpiling as CJS
    entryPoints: [ file ], // relative file name
    absWorkingDir: dir, // directory where file lives
    outdir: dir, // output in the same directory
    sourcemap: 'inline', // always inline source maps
    sourcesContent: false, // do not include sources content in sourcemap
    platform: 'node', // d'oh! :-)
    target: `node${process.versions['node']}`, // target _this_ version
    outExtension: { '.js': '.ts' }, // keep the output file name
    allowOverwrite: true, // input and output file names are the same
    write: false, // we definitely _do not_ write this back to disk
    define: { // those are defined/documented in "./globals.ts"
      __fileurl: '__filename',
      __esm: 'false',
      __cjs: 'true',
    },
  }

  /* Emit a line on the console when loading in debug mode */
  if (_debug) {
    options.banner = {
      // eslint-disable-next-line no-template-curly-in-string
      js: 'console.log(`[ts-loader|cjs]: Loaded "${__filename}"`);',
    }
  }

  /* Transpile our TypeScript file into some JavaScript stuff */
  let result
  try {
    result = _esbuild.buildSync(options)
  } catch (cause) {
    _esbReport(filename, cause as _esbuild.BuildFailure)
    // If the above doesn't fail (normal error?) then bail out
    _throw(`ESBuild error transpiling "${filename}"`, { cause })
  }

  /* Report out any warning or error and fail if there are errors */
  _esbReport(filename, result)

  /* Let node do its thing, but wrap any error it throws */
  try {
    module._compile(_esbResult(filename, result), filename)
  } catch (cause) {
    _throw(`[ts-loader] Error compiling module "${filename}"`, { cause })
  }
}

/* Remember to load our loader for .TS/.CTS as CommonJS modules */
_module._extensions['.ts'] = _module._extensions['.cts'] = loader

/* ========================================================================== *
 * FIN...                                                                     *
 * ========================================================================== */

/* Mark our `globalThis` as having our `tsLoaderMarker` symbol */
const tsLoaderMarker = Symbol.for('plugjs:tsLoader')
;(globalThis as any)[tsLoaderMarker] = tsLoaderMarker

// @ts-ignore: https://github.com/microsoft/TypeScript/issues/49842
_log('---', `Installing loader from "${import.meta.url}"`)
