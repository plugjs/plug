#!/usr/bin/env node

import type { Build, Run, BuildFailure } from '../src/index.js'

import _yargs from 'yargs-parser'

import _childProcess from 'node:child_process'
import _fs from 'node:fs'
import _path from 'node:path'
import _url from 'node:url'

/* ========================================================================== *
 * ========================================================================== *
 * PROCESS SETUP                                                              *
 * ========================================================================== *
 * ========================================================================== */

/* eslint-disable no-console */

/* We have everyhing we need to start our asynchronous main! */
async function main(options: CommandLineOptions): Promise<void> {
  const { buildFile, tasks, listOnly } = options
  if (tasks.length === 0) tasks.push('default')

  let build = await import(buildFile)
  while (build && (! isBuild(build))) build = build.default

  if (! isBuild(build)) {
    console.log('Build file did not export a proper build')
    console.log()
    console.log('- If using CommonJS export your build as "module.exports"')
    console.log('  e.g.: module.exports = build({ ... })')
    console.log()
    console.log('- If using ESM modules export your build as "default"')
    console.log('  e.g.: export default build({ ... })')
    console.log()
    process.exit(1)
  }

  for (const task of tasks) {
    if (task in build) continue
    console.log(`Build file does not contain task "${task}"`)
    process.exit(1)
  }

  if (listOnly) {
    console.log('Build file tasks\n- ' + Object.keys(build).sort().join('\n- '))
  } else {
    let run: Run | undefined
    for (const task of tasks) {
      run = await build[task](run)
    }
  }
}

/* Check for source maps and typescript support */
const sourceMapsEnabled = process.execArgv.indexOf('--enable-source-maps') >= 0

/* Check if our `ts-loader` loader is enabled */
const tsLoaderMarker = Symbol.for('plugjs:tsLoader')
const typeScriptEnabled = (globalThis as any)[tsLoaderMarker] === tsLoaderMarker


if (process.env.DEBUG_CLI === 'true') {
  console.log('SourceMaps enabled =', sourceMapsEnabled)
  console.log('TypeScript enabled =', typeScriptEnabled)
  console.log('         Arguments =', process.argv.join(' '))
  console.log('               PID =', process.pid)
}

/* Parse command line options */
const options = parseCommandLine()

/* If both source maps and typescript are on, run! */
if (sourceMapsEnabled && typeScriptEnabled) {
  main(options)
      .then(() => process.exit(0))
      .catch((error) => {
        if (! isBuildFailure(error)) console.log(error)
        process.exit(1)
      })
} else {
  // @ts-ignore: https://github.com/microsoft/TypeScript/issues/49842
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
  const env = options.forceEsm ?
    { __TS_LOADER_FORCE_ESM: process.cwd(), ...process.env } :
    process.env

  /* Fork ourselves! */
  const child = _childProcess.fork(script, [ ...process.argv.slice(2) ], {
    stdio: [ 'inherit', 'inherit', 'inherit', 'ipc' ],
    execArgv,
    env,
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

/* ========================================================================== *
 * ========================================================================== *
 * BUILD INSPECTION                                                           *
 * ========================================================================== *
 * ========================================================================== */

/** Symbol indicating that an object is a Build */
const buildMarker = Symbol.for('plugjs:isBuild')

/** Symbol indicating that an object is a Build Failure */
const buildFailure = Symbol.for('plugjs:buildFailure')

/** Check if the specified build is actually a {@link Build} */
export function isBuild(build: any): build is Build<any> {
  return build && build[buildMarker] === buildMarker
}

/** Check if the specified argument is a {@link BuildFailure} */
export function isBuildFailure(arg: any): arg is BuildFailure {
  return arg && arg[buildFailure] === buildFailure
}

/* Parsed and normalised command line options */
export interface CommandLineOptions {
  buildFile: string,
  tasks: string[],
  listOnly: boolean,
  forceEsm: boolean,
}


/* ========================================================================== *
 * ========================================================================== *
 * PARSE COMMAND LINE ARGUMENTS                                               *
 * ========================================================================== *
 * ========================================================================== */

/** Parse `perocess.argv` and return our normalised command line options */
export function parseCommandLine(): CommandLineOptions {
  /* Yargs-parse our arguments */
  const parsed = _yargs(process.argv.slice(2), {
    configuration: {
      'camel-case-expansion': false,
      'strip-aliased': true,
      'strip-dashed': true,
    },

    alias: {
      'force-esm': [ 'e' ],
      'verbose': [ 'v' ],
      'quiet': [ 'q' ],
      'colors': [ 'c' ],
      'file': [ 'f' ],
      'list': [ 'l' ],
      'help': [ 'h' ],
    },

    string: [ 'file' ],
    boolean: [ 'help', 'colors', 'list', 'force-esm' ],
    count: [ 'verbose', 'quiet' ],
  })

  /* ======================================================================== *
   * NORMALIZE YARGS ARGUMENTS                                                *
   * ======================================================================== */

  /* Our options */
  const tasks: string[] = []
  let verbosity = 0 // yargs always returns 0 for count (quiet/verbose)
  let colors: boolean | undefined = undefined
  let file: string | undefined = undefined
  let forceEsm = false
  let listOnly = false
  let help = false

  /* Switcharoo on arguments */
  for (const key in parsed) {
    switch (key) {
      case '_': // extra arguments
        tasks.push(...parsed[key].map((s) => `${s}`))
        break
      case 'verbose': // increase verbosity
        verbosity = verbosity + parsed[key]
        break
      case 'quiet': // decrease verbosity
        verbosity = verbosity - parsed[key]
        break
      case 'file': // build file
        file = parsed[key]
        break
      case 'force-esm':
        forceEsm = !! parsed[key]
        break
      case 'colors':
        colors = !! parsed[key]
        break
      case 'list':
        listOnly = !! parsed[key]
        break
      case 'help':
        help = !! parsed[key]
        break
      default:
        console.log(`Unsupported option "${key}" (try "--help")`)
        process.exit(1)
    }
  }

  /* ======================================================================== *
   * HELP OR NOT                                                              *
   * ======================================================================== */

  /* If help, end here! */
  if (help) {
    console.log(`Usage:

    plugjs [--options] [... tasks]

    Options:
      -v --verbose    Increase logging verbosity
      -q --quiet      Decrease logging verbosity
      -c --colors     Force colorful output (use "--no-colors" to force plain text)
      -e --force-esm  Force our TypeScript loader to interpret ".ts" files as ESM
      -f --file       Specify the build file to use (default "./build.[ts/js/...]")
      -l --list       Only list the tasks defined by the build, nothing more!
      -h --help       Help! You're reading it now!

    Tasks:
      Any other argument will be treated as a task name. If no task names are
      specified, the "default" task will be executed.
  `)

    process.exit(1)
  }

  /* ======================================================================== *
   * LOG OPTIONS AS ENVIRONMENT VARIABLES                                     *
   * ======================================================================== */

  /* Log colors, overriding our LOG_COLORS environment variable */
  if (colors !== undefined) process.env.LOG_COLORS = `${colors}`

  /* Log level (from verbosity) overriding LOG_LEVEL */
  if (verbosity) {
    const levels = [ 'TRACE', 'DEBUG', 'INFO', 'NOTICE', 'WARN', 'ERROR', 'OFF' ]
    let level = levels.indexOf('NOTICE') - verbosity
    if (level >= levels.length) level = levels.length - 1
    else if (level < 0) level = 0

    process.env.LOG_LEVEL = levels[level]
  }

  /* ======================================================================== *
   * BUILD FILE RESOLUTION                                                    *
   * ======================================================================== */

  /* Find our build file */
  const exts = [ 'ts', 'mts', 'mjs', 'js', 'mjs', 'cjs' ]

  let buildFile: string | undefined = undefined

  if (file) {
    const absolute = _path.resolve(file)
    if (! isFile(absolute)) {
      console.log(`Specified build file "${file}" was not found`)
      process.exit(1)
    } else {
      buildFile = absolute
    }
  } else {
    for (const ext of exts) {
      const absolute = _path.resolve(`build.${ext}`)
      if (! isFile(absolute)) continue
      buildFile = absolute
      break
    }
  }

  /* Final check */
  if (! buildFile) {
    console.log(`Unable to find build file "./build.[${exts.join('|')}]`)
    process.exit(1)
  }

  /* ======================================================================== *
   * ALL DONE                                                                 *
   * ======================================================================== */

  /* All done, here are our arguments parsed! */
  return { buildFile, tasks, forceEsm, listOnly }
}

/* ========================================================================== */

/* Returns a boolean indicating whether the specified file exists or not */
function isFile(path: string): boolean {
  try {
    return _fs.statSync(path).isFile()
  } catch (error) {
    return false
  }
}
