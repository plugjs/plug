'use strict'

const { buildSync, formatMessagesSync } = require('esbuild')

/* ========================================================================== *
 * HACK BEYOND REDEMPTION: TRANSPILE .ts FILES                                *
 * ========================================================================== */

const _path = require('node:path')
const _module = require('node:module')
const _debug = process.env.DEBUG_TS_LOADER === 'true'

function _report(filename, what) {
  const terminalWidth = process.stdout.columns || 80
  const color = !! process.stdout.isTTY

  const messages = []

  if (what.warnings && what.warnings.length) {
    const m = formatMessagesSync(what.warnings, { kind: 'warning', color, terminalWidth })
    messages.push(...m)
  }

  if (what.errors && what.errors.length) {
    const m = formatMessagesSync(what.errors, { kind: 'error', color, terminalWidth })
    messages.push(...m)
  }

  for (const message in messages) process.stdout.write(message)
  if (what.errors && what.errors.length) {
    throw new Error(`ESBuild errors in "${filename}"`, { cause })
  }
}

if (! ('.ts' in _module._extensions)) {
  if (_debug) console.log(`Installing TS loader from "${__filename}"`)

  _module._extensions['.ts'] = (_mod, filename) => {
    if (_debug) console.log(`Compiling "${filename}"`)
    const file = _path.basename(filename)
    const dir = _path.dirname(filename)

    let result
    try {
      result = buildSync({
        absWorkingDir: dir,
        outdir: dir,
        entryPoints: [ file ],
        sourcemap: 'inline',
        sourcesContent: false,
        platform: 'node',
        outExtension: { '.js': '.ts' },
        target: `node${process.versions['node']}`,
        format: 'cjs',
        allowOverwrite: true,
        write: false,
      })
    } catch (cause) {
      _report(filename, cause)
      throw new Error(`ESBuild errors compiling "${filename}"`, { cause })
    }

    _report(filename, result)

    const output = result.outputFiles.reduce((output, current) => {
      output[current.path] = current.text
      return output
    }, {})

    if (!(filename in output)) {
      console.log(Object.keys(output))
      throw new Error(`ESBuild produced no output for "${filename}"`)
    }

    try {
      _mod._compile(output[filename], filename)
    } catch (cause) {
      throw new Error(`Error compiling module "${filename}"`, { cause })
    }
  }
}
