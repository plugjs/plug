/* eslint-disable no-console */
import _childProcess from 'node:child_process'
import _fs from 'node:fs'
import _path from 'node:path'
import _url from 'node:url'
import _util from 'node:util'

/* ========================================================================== *
 * PRETTY COLORS                                                              *
 * ========================================================================== */

export const $rst = process.stdout.isTTY ? '\u001b[0m' : '' // reset all colors to default
export const $und = process.stdout.isTTY ? '\u001b[4m' : '' // underline on
export const $gry = process.stdout.isTTY ? '\u001b[38;5;240m' : '' // somewhat gray
export const $blu = process.stdout.isTTY ? '\u001b[38;5;69m' : '' // brighter blue
export const $wht = process.stdout.isTTY ? '\u001b[1;38;5;255m' : '' // full-bright white
export const $tsk = process.stdout.isTTY ? '\u001b[38;5;141m' : '' // the color for tasks (purple)


/* ========================================================================== *
 * PACKAGE VERSION                                                            *
 * ========================================================================== */

export function version(): string {
  const debug = _util.debuglog('plug:utils')

  try {
    const thisFile = _url.fileURLToPath(import.meta.url)
    const packageFile = _path.resolve(thisFile, '..', '..', 'package.json')
    const packageData = _fs.readFileSync(packageFile, 'utf-8')
    return JSON.parse(packageData).version || '(unknown)'
  } catch (error) {
    debug('Error parsing version:', error)
    return '(error)'
  }
}

/* ========================================================================== *
 * TS LOADER FORCE TYPE                                                       *
 * ========================================================================== */

function forceType(type: 'commonjs' | 'module'): void {
  const debug = _util.debuglog('plug:utils')

  const tsLoaderMarker = Symbol.for('plugjs:tsLoader')

  if (!(tsLoaderMarker in globalThis)) {
    throw new Error('TypeScript Loader not available')
  }
  debug(`Forcing type to "${type}"`)
  ;(globalThis as any)[tsLoaderMarker] = type
}


/* ========================================================================== *
 * FILES UTILITIES                                                            *
 * ========================================================================== */

/* Returns a boolean indicating whether the specified file exists or not */
export function isFile(path: string): boolean {
  try {
    return _fs.statSync(path).isFile()
  } catch (error) {
    return false
  }
}

/* Returns a boolean indicating whether the specified directory exists or not */
export function isDirectory(path: string): boolean {
  try {
    return _fs.statSync(path).isDirectory()
  } catch (error) {
    return false
  }
}


/* ========================================================================== *
 * MAIN ENTRY POINT                                                           *
 * ========================================================================== */
export function main(callback: (args: string[]) => void): void {
  const debug = _util.debuglog('plug:utils')

  /* Check for source maps and typescript support */
  const sourceMapsEnabled = process.execArgv.indexOf('--enable-source-maps') >= 0

  /* Check if our `ts-loader` loader is enabled */
  const tsLoaderMarker = Symbol.for('plugjs:tsLoader')
  const typeScriptEnabled = (globalThis as any)[tsLoaderMarker]

  /* Some debugging if needed */
  debug('SourceMaps enabled =', sourceMapsEnabled)
  debug('TypeScript enabled =', typeScriptEnabled || false)

  /* If both source maps and typescript are on, run! */
  if (sourceMapsEnabled && typeScriptEnabled) {
    const args = process.argv.slice(2).filter((arg: string): string | void => {
      if (arg === '--force-esm') {
        return forceType('module')
      } else if (arg === '--force-cjs') {
        return forceType('commonjs')
      } else {
        return arg
      }
    })


    return callback(args)
  } else {
    const script = _url.fileURLToPath(import.meta.url)

    /* Fork out ourselves with new options */
    const execArgv = [ ...process.execArgv ]

    /* Enable source maps if not done already */
    if (! sourceMapsEnabled) execArgv.push('--enable-source-maps')

    /* Enable our ESM TypeScript loader if not done already */
    if (! typeScriptEnabled) {
      const directory = _path.dirname(script)
      const extension = _path.extname(script) // .mts or .mjs
      const loader = _path.resolve(directory, `ts-loader${extension}`)
      execArgv.push(`--experimental-loader=${loader}`, '--no-warnings')
    }

    /*
     * It seems that setting "type" as "module" in "package.json" creates some
     * problems when the module is being imported from a "commonjs" one.
     *
     * TypeScript _incorrectly_ says (regardless of how we set up our conditional
     * exports) that we must use dynamic imports:
     *
     *     Module '@plugjs/plug' cannot be imported using this construct. The
     *     specifier only resolves to an ES module, which cannot be imported
     *     synchronously. Use dynamic import instead.
     *     TS(1471)
     *
     * So for now our only option is to leave "type" as "commonjs", and for those
     * brave souls willing to force ESM irregardless of what's in "package.json",
     * we allow the "--force-esm" option, and instruct `ts-loader` that the
     * current directory (and subdirs) will transpile as ESM always.
     */

    /* Fork ourselves! */
    const child = _childProcess.fork(script, [ ...process.argv.slice(2) ], {
      stdio: [ 'inherit', 'inherit', 'inherit', 'ipc' ],
      execArgv,
    })

    /* Monitor child process... */
    child.on('error', (error) => {
      console.log('Error respawning CLI', error)
      process.exit(1)
    })

    child.on('exit', (code, signal) => {
      if (signal) {
        console.log(`CLI process exited with signal ${signal}`)
        process.exit(1)
      } else if (typeof code !== 'number') {
        console.log('CLI process failed for an unknown reason')
        process.exit(1)
      } else {
        process.exit(code)
      }
    })
  }
}
