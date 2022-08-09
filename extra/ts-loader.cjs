'use strict'

const { buildSync, formatMessagesSync } = require('esbuild')

/* ========================================================================== *
 * HACK BEYOND REDEMPTION: TRANSPILE .ts FILES                                *
 * ========================================================================== */

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

    let result
    try {
      result = buildSync({
        entryPoints: [ filename ],
        sourcemap: 'inline',
        platform: 'node',
        target: `node${process.versions['node']}`,
        format: 'cjs',
        write: false,
      })
    } catch (cause) {
      _report(filename, cause)
      throw new Error(`ESBuild errors in "${filename}"`, { cause })
    }

    _report(filename, result)

    if (result.outputFiles.length !== 1) {
      throw new Error(`ESBuild produced ${result.outputFiles.length} files for "${filename}"`)
    }

    try {
      _mod._compile(result.outputFiles[0].text, filename)
    } catch (cause) {
      throw new Error(`Error compiling module "${filename}"`, { cause })
    }
  }
}
