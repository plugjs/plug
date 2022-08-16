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
 * We need to _actually verify_ on disk what's the correct file to import.    *
 *                                                                            *
 * This is a single module, only available as ESM, and it will _both_ behave  *
 * as a NodeJS' loader, _and_ inject the CJS extension handlers (hack) found  *
 * in the `_extensions` of `node:module` (same as `require.extensions`).      *
 * ========================================================================== */

// ESBuild is the only external dependency
import _esbuild from 'esbuild'

// NodeJS dependencies
import _fs from 'node:fs'
import _module from 'node:module'
import _path from 'node:path'
import _url from 'node:url'
import _workers from 'node:worker_threads'


/* ========================================================================== *
 * DEBUGGING AND ERRORS                                                       *
 * ========================================================================== */

/** Supported types from `package.json` */
type Type = 'commonjs' | 'module'
/** Constant identifying a `commonjs` module */
const CJS = 'commonjs'
/** Constant identifying an ESM `module` */
const ESM = 'module'

/** Flag indicating whether to debug or not (checks `DEBUG_TS_LOADER`) */
const _debug = process.env.DEBUG_TS_LOADER === 'true'

/** Emit some logs if `DEBUG_TS_LOADER` is set to `true` */
function _log(type: Type | null, ...args: string []): void {
  if (! _debug) return

  const thread = _workers.isMainThread ? 'main' : _workers.threadId
  const prefix = `[ts-loader|${type || '-'}|pid=${process.pid}|tid=${thread}]`

  // eslint-disable-next-line no-console
  console.log(prefix, ...args)
}

/** Fail miserably */
function _throw(
    type: Type | null,
    message: string,
    options: { start?: Function, code?: string, cause?: any } = {},
): never {
  const thread = _workers.isMainThread ? 'main' : _workers.threadId
  const prefix = `[ts-loader|${type || '-'}|pid=${process.pid}|tid=${thread}]`

  const { start = _throw, ...extra } = options
  const error = new Error(`${prefix} ${message}`)
  Error.captureStackTrace(error, start)
  Object.assign(error, extra)

  throw error
}


/* ========================================================================== *
 * FILES AND DISCOVERY                                                        *
 * ========================================================================== */

/** Cache for directory to module format as discovered in "package.json" */
const _moduleFormatCache = new Map<string, Type>()

/**
 * Figures out the _default_ module type for a directory, looking into the
 * `package.json`'s `type` field (either `commonjs` or `module`)
 */
function _moduleFormat(directory: string): Type {
  /* Before doing anything else, check our cache */
  const type = _moduleFormatCache.get(directory)
  if (type) return type

  /* Try to read the "package.json" file from this directory */
  const file = _path.resolve(directory, 'package.json')

  try {
    const json = _fs.readFileSync(file, 'utf-8')
    const data = JSON.parse(json)

    /* Be liberal in what you accept? Default to CommonJS if none found */
    const type = data.type === 'module' ? ESM : CJS
    _log(null, `File "${file}" defines module type as "${data.type}" (${type})`)
    _moduleFormatCache.set(directory, type)
    return type
  } catch (cause: any) {
    /* We _accept_ a couple of errors, file not found, or file is directory */
    if ((cause.code !== 'ENOENT') && (cause.code !== 'EISDIR')) {
      _throw(null, `Unable to read or parse "${file}"`, { cause, start: _moduleFormat })
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
    _moduleFormatCache.set(directory, CJS) // default
    return CJS
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
    type: Type,
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
    _throw(type, `ESBuild found ${errors.length} errors in "${filename}"`, { start: _esbReport })
  }
}

/**
 * Return the _code_ produced by ESBuild (as a string) for the given file name
 * or fail miserable if that was not produced
 */
function _esbResult(
    type: Type,
    filename: string,
    result?: _esbuild.BuildResult,
): string {
  if (! result) _throw(type, `No result returned by ESBuild for ${filename}`, { start: _esbResult })
  if (! result.outputFiles) _throw(type, `No output files produced by ESBuild for ${filename}`, { start: _esbResult })

  for (const output of result.outputFiles) {
    if (output.path === filename) return output.text
  }

  _throw(type, `ESBuild produced no output for "${filename}"`, { start: _esbResult })
}

/**
 * Transpile with ESBuild
 */
function _esbTranpile(filename: string, type: Type): string {
  _log(type, `Transpiling "${filename}`)

  const file = _path.basename(filename)
  const dir = _path.dirname(filename)
  const ext = _path.extname(filename)

  const fileurl = type === 'module' ? 'import.meta.url' : '__filename'
  const format = type === 'module' ? 'esm' : 'cjs'

  /* ESbuild options */
  const options: _esbuild.BuildOptions = {
    format, // what are we actually transpiling to???
    entryPoints: [ file ], // relative file name
    absWorkingDir: dir, // directory where file lives
    outdir: dir, // output in the same directory
    sourcemap: 'inline', // always inline source maps
    sourcesContent: false, // do not include sources content in sourcemap
    platform: 'node', // d'oh! :-)
    target: `node${process.versions['node']}`, // target _this_ version
    outExtension: { '.js': ext }, // keep the output file name
    allowOverwrite: true, // input and output file names are the same
    write: false, // we definitely _do not_ write this back to disk
    define: { // those are defined/documented in "./globals.ts"
      __fileurl: fileurl,
      __esm: 'true',
      __cjs: 'false',
    },
  }
  /* Emit a line on the console when loading in debug mode */

  if (_debug) {
    options.banner = {
      js: `console.log(\`[ts-loader|${type}]: Loaded "\${${fileurl}}"\`);`,
    }
  }

  /* Transpile our TypeScript file into some JavaScript stuff */
  let result
  try {
    result = _esbuild.buildSync(options)
  } catch (cause) {
    _esbReport(type, filename, cause as _esbuild.BuildFailure)
    // If the above doesn't fail (normal error?) then bail out
    _throw(type, `ESBuild error transpiling "${filename}"`, { cause, start: _esbTranpile })
  }

  /* Report out any warning or error and fail if there are errors */
  _esbReport(type, filename, result)

  /* Finally return our transpiled code */
  return _esbResult(type, filename, result)
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
type ResolveNext = (specifier: string, context: ResolveContext) => ResolveResult | Promise<ResolveResult>

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
type LoadNext = (url: string, context: LoadContext) => LoadResult | Promise<LoadResult>

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

/**
 * Our main `resolve` hook: here we need to check for a couple of options
 * when importing ""
 */
export const resolve: ResolveHook = (specifier, context, nextResolve): ResolveResult | Promise<ResolveResult> => {
  _log(ESM, `Resolving "${specifier}" from "${context.parentURL}"`)

  /* We only resolve relative paths ("./xxx" or "../xxx") */
  if (! specifier.match(/^\.\.?\//)) return nextResolve(specifier, context)

  /* We only resolve if we _do_ have a parent URL and it's a file */
  const parentURL = context.parentURL
  if (! parentURL) return nextResolve(specifier, context)
  if (! parentURL.startsWith('file:')) return nextResolve(specifier, context)

  /* We only resolve here if the importer is a ".ts" or ".mts" file */
  if (! parentURL.match(/\.m?ts$/)) return nextResolve(specifier, context)

  /* The resolved URL is the specifier resolved against the parent */
  const url = new URL(specifier, parentURL).href
  const path = _url.fileURLToPath(url)

  /*
   * Here we are sure that:
   *
   * 1) we are resolving a local path (not a module)
   * 2) the importer is a file, ending with ".ts" or ".mts"
   *
   * Now we can check if "import 'foo'" resolves to:
   *
   * 1) directly to a file, e.g. "import './foo.js'" or "import './foo.mts'"
   * 2) import a "pseudo-JS file", e.g. "import './foo.js'" becomes "import './foo.ts'"
   * 3) imports a file without extension as if it were "import './foo.ts'"
   * 4) imports a directory  as in "import './foo/index.ts'"
   *
   * We resolve the _final_ specifier that will be passed to the next resolver
   * for further potential resolution accordingly.
   *
   * We start with the easiest case: is this a real file on the disk?
   */
  if (_isFile(path)) {
    _log(ESM, `Positive match for "${specifier}" as "${path}" (1)`)
    return nextResolve(specifier, context) // straight on
  }

  /*
   * TypeScript allows us to import "./foo.js", and internally resolves this to
   * "./foo.ts" (yeah, nice, right?) and while we normally wouldn't want to deal
   * with this kind of stuff, the "node16" module resolution mode _forces_ us to
   * use this syntax.
   */
  const match = specifier.match(/(.*)(\.[mc]?js$)/)
  if (match) {
    const [ , base, ext ] = match
    const tsspecifier = base + ext.replace('js', 'ts')
    const tsurl = new URL(tsspecifier, parentURL).href
    const tspath = _url.fileURLToPath(tsurl)

    if (_isFile(tspath)) {
      _log(ESM, `Positive match for "${specifier}" as "${tspath}" (2)`)
      return nextResolve(specifier, context) // straight on
    }
  }

  /* Check if the import is actually a file with a ".ts" extension */
  if (_isFile(`${path}.ts`)) {
    _log(ESM, `Positive match for "${specifier}.ts" as "${path}.ts" (3)`)
    return nextResolve(`${specifier}.ts`, context)
  }

  /* If the file is a directory, then see if we have an "index.ts" in there */
  if (_isDirectory(path)) {
    const file = _path.resolve(path, 'index.ts') // resolve, as path is absolute
    const spec = _path.join(specifier, 'index.ts') // join only, specifier is relative
    if (_isFile(file)) {
      _log(ESM, `Positive match for "${spec}" as "${file}"  (4)`)
      return nextResolve(spec, context)
    }
  }

  /* There's really nothing else we can do */
  return nextResolve(specifier, context)
}

/** Our main `load` hook */
export const load: LoadHook = (url, context, nextLoad): LoadResult | Promise<LoadResult> => {
  _log(ESM, `Attempting to load "${url}"`)

  /* We only load from disk, so ignore everything else */
  if (! url.startsWith('file:')) return nextLoad(url, context)

  /* Figure our the extension (especially ".ts", ".mts" or ".cts")... */
  const ext = url.match(/\.[cm]?ts$/)?.[0]

  /* Quick and easy bail-outs for non-TS or ".cts" (always `commonjs`) */
  if (! ext) return nextLoad(url, context)
  if (ext === '.cts') return { format: 'commonjs' }

  /* Convert the url into a file name, any error gets ignored */
  const filename = _url.fileURLToPath(url)

  /* If the file is a ".ts", we need to figure out the default type */
  if (ext === '.ts') {
    const format = _moduleFormat(_path.dirname(filename))

    /* If the _default_ module type is 'commonjs' then load as such! */
    if (format === CJS) return { format: 'commonjs' }
  }

  /* Transpile with ESBuild */
  const source = _esbTranpile(filename, ESM)

  /* Done, return our transpiled code */
  return { source, format: 'module', shortCircuit: true }
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

/**
 * Add the `_extensions[...]` and `resolveFilename(...)` members to the
 * definition of `node:module`.
 */
declare module 'node:module' {
  const _extensions: Record<`.${string}`, ExtensionHandler>
  function _resolveFilename(
    request: string,
    parent: _module | undefined,
    isMain: boolean,
    options?: any,
  ): string
}

/* ========================================================================== */

const loader: ExtensionHandler = (module, filename): void => {
  _log(ESM, `Attempting to load "${filename}"`)

  /* Figure our the extension (".ts" or ".cts")... */
  const ext = _path.extname(filename)

  /* If the file is a ".ts", we need to figure out the default type */
  if (ext === '.ts') {
    const format = _moduleFormat(_path.dirname(filename))

    /* If the _default_ module type is 'commonjs' then load as such! */
    if (format === ESM) {
      _throw(CJS, `Must use import to load ES Module: ${filename}`, { code: 'ERR_REQUIRE_ESM' })
    }
  } else if (ext !== '.cts') {
    _throw(CJS, `Unsupported filename "${filename}"`)
  }

  const source = _esbTranpile(filename, CJS)

  /* Let node do its thing, but wrap any error it throws */
  try {
    module._compile(source, filename)
  } catch (cause) {
    _throw(CJS, `Error compiling module "${filename}"`, { cause })
  }
}

/* Remember to load our loader for .TS/.CTS as CommonJS modules */
_module._extensions['.ts'] = _module._extensions['.cts'] = loader

/**
 * Replace _module._resolveFilename with our own.
 *
 * This is a _HACK BEYOND REDEMPTION_ and I'm ashamed of even _thinking_ about
 * it, but, well, it makes things work.
 *
 * TypeScript allows us to import "./foo.js", and internally resolves this to
 * "./foo.ts" (yeah, nice, right?) and while we normally wouldn't want to deal
 * with this kind of stuff, the "node16" module resolution mode _forces_ us to
 * use this syntax.
 *
 * And we _need_ the "node16" module resolution to properly consume "export
 * conditions" from other packages. Since ESBuild's plugins only work in async
 * mode, changing those import statements on the fly is out of the question, so
 * we need to hack our way into Node's own resolver.
 *
 * See my post: https://twitter.com/ianosh/status/1559484168685379590
 * ESBuild related fix: https://github.com/evanw/esbuild/commit/0cdc005e3d1c765a084f206741bc4bff78e30ec4
 */
const _oldResolveFilename = _module._resolveFilename
_module._resolveFilename = function(
    request: string,
    parent: _module | undefined,
    ...args: [ isMain: boolean, options: any ]
): any {
  try {
    /* First call the old _resolveFilename to see what Node thinks */
    return _oldResolveFilename.call(this, request, parent, ...args)
  } catch (error: any) {
    /* If the error was anything but "MODULE_NOT_FOUND" bail out */
    if (error.code !== 'MODULE_NOT_FOUND') throw error

    /* Check if the "request" ends with ".js", ".mjs" or ".cjs" */
    const match = request.match(/(.*)(\.[mc]?js$)/)

    /*
     * If the file matches our extension, _and_ we have a parent, we simply
     * try with a new extension (e.g. ".js" becomes ".ts")...
     */
    if (parent && match) {
      const [ , name, ext ] = match
      const tsrequest = name + ext.replace('js', 'ts')
      try {
        const result = _oldResolveFilename.call(this, tsrequest, parent, ...args)
        _log('commonjs', `Resolution for "${request}" intercepted as "${tsrequest}`)
        return result
      } catch (discard) {
        throw error // throw the _original_ error in this case
      }
    }

    /* We have no parent, or we don't match our extension, throw! */
    throw error
  }
}

/* ========================================================================== *
 * FIN...                                                                     *
 * ========================================================================== */

/* Mark our `globalThis` as having our `tsLoaderMarker` symbol */
const tsLoaderMarker = Symbol.for('plugjs:tsLoader')
;(globalThis as any)[tsLoaderMarker] = tsLoaderMarker

// @ts-ignore: https://github.com/microsoft/TypeScript/issues/49842
_log(null, `Installing loader from "${import.meta.url}"`)
