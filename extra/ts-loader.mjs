import _esbuild from 'esbuild'
import _url from 'node:url'
import _module from 'node:module'
import _path from 'node:path'
import _fs from 'node:fs'

/* ========================================================================== *
 * HACK BEYOND REDEMPTION: TRANSPILE .ts FILES (the esm version)              *
 * -------------------------------------------------------------------------- *
 * This relies on the node `--experimental-loader` feature, and uses the same *
 * ESBuild magic to transpile TypeScript files into JavaScript.               *
 * A substantial difference between this and the CJS version is that ESM's    *
 * `import` statements must point to a full file (including extension) so in  *
 * the transpiling process, we use a resolver plugin checking the various     *
 * possiblities a file can be loaded from... Warning: this might fail! :-)    *
 * ========================================================================== */

/** Debuggin' stuff */
const _debug = process.env.DEBUG_TS_LOADER === 'true'
function _log(...args) {
  if (_debug) console.log(`[ts-loader|esm|${process.pid}]:`, ...args)
}

/**
 * Take an ESBuild `BuildResult` or `BuildFailure` (they both have arrays
 * of `Message` in both `warnings` and `errors`), format them and print them
 * out nicely. Then fail if any error was detected.
 */
function _report(filename, what) {
  const { warnings = [], errors = [] } = what

  const output = process.stderr
  const options = { color: !!output.isTTY, terminalWidth: output.columns || 80 }

  const messages = [
    ... _esbuild.formatMessagesSync(warnings, { kind: 'warning', ...options }),
    ... _esbuild.formatMessagesSync(errors, { kind: 'error', ...options }),
  ]

  messages.forEach((message) => output.write(`${message}\n`))

  if (errors.length) {
    const message = `[ts-loader] ESBuild found ${errors.length} errors in "${filename}"`
    throw new Error(message, { cause: what })
  }
}

/* ========================================================================== */

/* Mark the fact we're loaded... */
_log(`Installing TS loader from "${import.meta.url}"`)

/* First and foremost, this loader also loads its CJS counterpart */
_module.createRequire(import.meta.url)('./ts-loader.cjs');

/* Check if the given specifier identifies a ".ts" file */
const isTypescript = (specifier) => specifier.endsWith('.ts')

export async function resolve(specifier, context, nextResolve) {
  if (! isTypescript(specifier)) return nextResolve(specifier, context)

  /* The parent URL is either from the context, or the process.cwd() value */
  const { parentURL = `${_url.pathToFileURL(process.cwd()).href}/` } = context;

  /* The resolved URL is the specifier resolved against the parent */
  const url = new URL(specifier, parentURL).href;

  /* Let's see what's going on */
  _log(`Resolved URL: "${url}"`)
  _log(`|  specifier: "${specifier}"`)
  _log(`| parent URL: "${context.parentURL}"`)

  /* All done, short circuit the result */
  return { shortCircuit: true, url }
}

export async function load(url, context, nextLoad) {
  if (! isTypescript(url)) return nextLoad(url, context)

  /* Convert the url into a path */
  let filename = undefined
  try {
    filename = _url.fileURLToPath(url)
  } catch (error) {
    // swallow errors... simply a non-file URL
    return nextLoad(url, context);
  }

  /* We always operate relative to the file */
  const file = _path.basename(filename)
  const dir = _path.dirname(filename)

  /* ESbuild options */
  const options = {
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
      __tsLoaderCJS: 'globalThis.__tsLoaderCJS',
      __tsLoaderESM: 'globalThis.__tsLoaderESM',
      __fileurl: 'import.meta.url',
      __esm: 'true',
      __cjs: 'false',
    },
    bundle: true, // trigger a "bundle" build to analyse imports one by one
    plugins: [ _addImportExtension ], // our plugin adding extensions
  }

  /* Emit a line on the console when loading in debug mode */
  if (_debug) options.banner = {
    js: 'console.log(`[ts-loader|esm|${process.pid}]: Loaded "${import.meta.url}"`);'
  }

  /* Transpile our TypeScript file into some JavaScript stuff */
  let result
  try {
    result = await _esbuild.build(options)
  } catch (cause) {
    _report(filename, cause)
    // If the above doesn't fail (normal error?) then bail out
    throw new Error(`[ts-loader] ESBuild error transpiling "${filename}"`, { cause })
  }

  /* Report out any warning or error and fail if there are errors */
  _report(filename, result)

  /* Normalize the output of the result into { filename: code } */
  const output = result.outputFiles.reduce((output, current) => {
    output[current.path] = current.text
    return output
  }, {})

  /* Make sure we _do_ have some code transpiled */
  if (!(filename in output)) {
    throw new Error(`[ts-loader] ESBuild produced no output for "${filename}"`)
  }

  /* Done, return our transpiled code */
  return {
    format: 'module',
    shortCircuit: true,
    source: output[filename],
  }
}

/* ========================================================================== */

/* Returns a boolean indicating whether the specified file exists or not */
function isFile(path) {
  try {
    return _fs.statSync(path).isFile()
  } catch (error) {
    return false
  }
}

/* Extensions to look for when having something like `import x from './foo'` */
const _extensions = [ '.ts', '.mjs', '.cjs', '.js' ]

/* ESBuild plugin to discover imported files, and returning the resolved path */
const _addImportExtension = {
  name: 'ts-loader',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      /* If this is the "root" file (it has no importer) return it unchanged */
      if (! args.importer) return { external: false }
      /* If the import does not start with './' or '../' then it's not ours */
      if (! args.path.match(/^\.\.?\//)) return { external: true }

      /* The directory  to resolve against is the directory of the importer */
      const directory = _path.dirname(args.importer)
      const target = _path.resolve(directory, args.path)

      _log(`Importing "${args.path}" in "${args.importer}"`)

      /* If the file exists as-is, then just import it as-is */
      if (isFile(target)) {
        _log(`|   found "${args.path}" as "${target}"`)
        return { external: true } // easy peasy :-)
      }

      /* Nope, not found */
      _log(`|   wrong "${args.path}" as "${target}"`)

      /* Look for our various extensions, one-by-one */
      for (const ext of _extensions) {
        const newTarget = target + ext
        const newPath = args.path + ext
        if (isFile(newTarget)) {
          _log(`|   found "${newPath}" as "${newTarget}"`)
          return { path: newPath, external: true }
        } else {
          _log(`|   wrong "${newPath}" as "${newTarget}"`)
        }
      }

      /* Second try: treat the argument as a directory, and use the index */
      for (const ext of _extensions) {
        const index = 'index' + ext
        const newTarget = _path.resolve(target, index)
        const newPath = _path.join(args.path, index)
        if (isFile(newTarget)) {
          _log(`|   found "${newPath}" as "${newTarget}"`)
          return { path: newPath, external: true }
        } else {
          _log(`|   wrong "${newPath}" as "${newTarget}"`)
        }
      }

      /* We checked any possibility and found none... Give up! */
      return { external: true } // always "external"
    })
  }
}

/* ========================================================================== *
 * SELF REGISTRATION IN GLOBAL                                                *
 * ========================================================================== */
globalThis.__tsLoaderESM = true
