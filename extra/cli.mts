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
async function main(): Promise<void> {
  const { buildFile, tasks, listOnly } = parseCommandLine()
  if (tasks.length === 0) tasks.push('default')

  const exports = await import(buildFile)

  let build = exports
  while (build && (! isBuild(build))) build = build.default

  if (! build) {
    console.log('Build file did not export a proper build')
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
    for (const task of tasks) await build[task]()
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

/* If both source maps and typescript are on, run! */
if (sourceMapsEnabled && typeScriptEnabled) {
  main()
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
export function isBuild(build: any): build is Record<string, () => Promise<void>> {
  return build && build[buildMarker] === buildMarker
}

/** Check if the specified argument is a {@link BuildFailure} */
export function isBuildFailure(arg: any): boolean {
  return arg && arg[buildFailure] === buildFailure
}

/* Parsed and normalised command line options */
export interface CommandLineOptions {
  buildFile: string,
  tasks: string[],
  listOnly: boolean,
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
      'camel-case-expansion': true,
      'strip-aliased': true,
      'strip-dashed': true,
    },

    alias: {
      verbose: [ 'v' ],
      quiet: [ 'q' ],
      colors: [ 'c' ],
      file: [ 'f' ],
      list: [ 'l' ],
      help: [ 'h' ],
    },

    string: [ 'file' ],
    boolean: [ 'help' ],
    count: [ 'verbose', 'quiet' ],
  })

  /* ======================================================================== *
   * NORMALIZE YARGS ARGUMENTS                                                *
   * ======================================================================== */

  /* Our options */
  const tasks: string[] = []
  let verbosity: number | undefined
  let colors: boolean | undefined = undefined
  let file: string | undefined = undefined
  let listOnly = false
  let help = false

  /* Switcharoo on arguments */
  for (const key in parsed) {
    switch (key) {
      case '_': // extra arguments
        tasks.push(...parsed[key].map((s) => `${s}`))
        break
      case 'verbose': // increase verbosity
        verbosity = (verbosity || 0) + parsed[key]
        break
      case 'quiet': // decrease verbosity
        verbosity = (verbosity || 0) - parsed[key]
        break
      case 'file': // build file
        file = parsed[key]
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
      -v --verbose  Increase logging verbosity
      -q --quiet    Decrease logging verbosity
      -c --colors   Force colorful output (use "--no-colors" to force plain text)
      -f --file     Specify the build file to use (default "./build.[ts/js/...]")
      -l --list     Only list the tasks defined by the build, nothing more!
      -h --help     Help! You're reading it now!

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
  if (verbosity !== undefined) {
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
  return { buildFile, tasks, listOnly }
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
