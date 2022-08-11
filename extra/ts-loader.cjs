'use strict'

const _esbuild = require('esbuild')
const _path = require('node:path')

/* ========================================================================== *
 * HACK BEYOND REDEMPTION: TRANSPILE .ts FILES (the cjs version)              *
 * -------------------------------------------------------------------------- *
 * This is fairly simple, and relies on Node's own `require.extensions`       *
 * mechanism. We don't need to do anything fancy here, when the loader is     *
 * registered in the extensions, Node will automagically figure out what file *
 * to import when doing things like `require('foo')`                          *
 * ========================================================================== */

/** Debuggin' stuff */
const _debug = process.env.DEBUG_TS_LOADER === 'true'
function _log(...args) {
  if (_debug) console.log(`[ts-loader|cjs|${process.pid}]:`, ...args)
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

/** Register our ".ts" extension loader for CJS modules. */
if (! ('.ts' in require.extensions)) {
  _log(`Installing TS loader from "${__filename}"`)

  require.extensions['.ts'] = (module, filename) => {
    _log(`Transpiling "${filename}"`)

    /* We always operate relative to the file */
    const file = _path.basename(filename)
    const dir = _path.dirname(filename)

    /* ESbuild options */
    const options = {
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
        __tsLoaderCJS: 'globalThis.__tsLoaderCJS',
        __tsLoaderESM: 'globalThis.__tsLoaderESM',
        __fileurl: '__filename',
        __esm: 'false',
        __cjs: 'true',
      },
    }

    /* Emit a line on the console when loading in debug mode */
    if (_debug) options.banner = {
      js: 'console.log(`[ts-loader|cjs|${process.pid}]: Loaded "${__filename}"`);'
    }

    /* Transpile our TypeScript file into some JavaScript stuff */
    let result
    try {
      result = _esbuild.buildSync(options)
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

    /* Let node do its thing, but wrap any error it throws */
    const code = output[filename]
    try {
      module._compile(code, filename)
    } catch (cause) {
      if (_debug) {
        _log('>', filename)
        code.split('\n').forEach((line) => _log(`| ${line}`))
      }
      throw new Error(`[ts-loader] Error compiling module "${filename}"`, { cause })
    }
  }
}

/* ========================================================================== *
 * SELF REGISTRATION IN GLOBAL                                                *
 * ========================================================================== */
globalThis.__tsLoaderCJS = true
