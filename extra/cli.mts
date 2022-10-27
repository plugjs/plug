#!/usr/bin/env node

import _childProcess from 'node:child_process'
import _fs from 'node:fs'
import _path from 'node:path'
import _url from 'node:url'

import _yargs from 'yargs-parser'

import type { Type } from './ts-loader.mjs'
import type { Build, BuildFailure } from '../src/index.js'

// Colors...
const $rst = process.stdout.isTTY ? '\u001b[0m' : '' // reset all colors to default
const $und = process.stdout.isTTY ? '\u001b[4m' : '' // underline on
const $gry = process.stdout.isTTY ? '\u001b[38;5;240m' : '' // somewhat gray
const $blu = process.stdout.isTTY ? '\u001b[38;5;69m' : '' // brighter blue
const $wht = process.stdout.isTTY ? '\u001b[1;38;5;255m' : '' // full-bright white
const $tsk = process.stdout.isTTY ? '\u001b[38;5;141m' : '' // the color for tasks (purple)

/* ========================================================================== *
 * ========================================================================== *
 * PROCESS SETUP                                                              *
 * ========================================================================== *
 * ========================================================================== */

/* eslint-disable no-console */

/* We have everyhing we need to start our asynchronous main! */
async function main(options: CommandLineOptions): Promise<void> {
  const { buildFile, watchDirs, tasks, props, listOnly } = options
  if (tasks.length === 0) tasks.push('default')

  let maybeBuild = await import(buildFile)
  while (maybeBuild) {
    if (isBuild(maybeBuild)) break
    maybeBuild = maybeBuild.default
  }

  if (! isBuild(maybeBuild)) {
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

  const build = maybeBuild

  if (listOnly) {
    const taskNames: string[] = []
    const propNames: string[] = []

    for (const [ key, value ] of Object.entries(build)) {
      (typeof value === 'string' ? propNames : taskNames).push(key)
    }

    const buildFileName = _path.relative(process.cwd(), buildFile)

    console.log(`\n${$gry}Outline of ${$wht}${buildFileName}${$rst}`)

    console.log('\nKnown tasks:\n')
    for (const taskName of taskNames.sort()) {
      console.log(` ${$gry}\u25a0${$tsk} ${taskName}${$rst}`)
    }

    console.log('\nKnown properties:\n')
    for (const propName of propNames.sort()) {
      const value = build[propName] ?
        ` ${$gry}(default "${$rst}${$und}${build[propName]}${$gry})` : ''
      console.log(` ${$gry}\u25a1${$blu} ${propName}${value}${$rst}`)
    }

    console.log()
  } else if (watchDirs.length) {
    let timeout: NodeJS.Timeout | undefined = undefined

    const runme = (): void => {
      build[buildMarker](tasks, props)
          .then(() => {
            console.log(`\n${$gry}Watching for files change...${$rst}\n`)
          }, (error) => {
            if (isBuildFailure(error)) {
              console.log(`\n${$gry}Watching for files change...${$rst}\n`)
            } else {
              console.log(error)
              watchers.forEach((watcher) => watcher.close())
            }
          })
          .finally(() => {
            timeout = undefined
          })
    }

    const watchers = watchDirs.map((watchDir) => {
      return _fs.watch(watchDir, { recursive: true }, () => {
        if (! timeout) timeout = setTimeout(runme, 250)
      })
    })

    runme()
  } else {
    await build[buildMarker](tasks, props)
  }
}

/* ========================================================================== *
 * MAIN ENTRY POINT                                                           *
 * ========================================================================== */

/* Check for source maps and typescript support */
const sourceMapsEnabled = process.execArgv.indexOf('--enable-source-maps') >= 0

/* Check if our `ts-loader` loader is enabled */
const tsLoaderMarker = Symbol.for('plugjs:tsLoader')
const typeScriptEnabled = (globalThis as any)[tsLoaderMarker] === tsLoaderMarker

/* Some debugging if needed */
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
      // .then(() => process.exit(0))
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
  const env = options.force ?
    { __TS_LOADER_FORCE_TYPE: options.force, ...process.env } :
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
function isBuild(build: any): build is Build<Record<string, any>> & {
  [buildMarker]: (tasks: string[], props?: Record<string, string | undefined>) => Promise<void>
} {
  return build && typeof build[buildMarker] === 'function'
}

/** Check if the specified argument is a {@link BuildFailure} */
function isBuildFailure(arg: any): arg is BuildFailure {
  return arg && arg[buildFailure] === buildFailure
}

/* ========================================================================== *
 * ========================================================================== *
 * PARSE COMMAND LINE ARGUMENTS                                               *
 * ========================================================================== *
 * ========================================================================== */

/* Parsed and normalised command line options */
interface CommandLineOptions {
  buildFile: string,
  watchDirs: string[],
  tasks: string[],
  props: Record<string, string>
  listOnly: boolean,
  force?: Type | undefined,
}


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
      'verbose': [ 'v' ],
      'quiet': [ 'q' ],
      'colors': [ 'c' ],
      'file': [ 'f' ],
      'list': [ 'l' ],
      'watch': [ 'w' ],
      'help': [ 'h' ],
    },

    string: [ 'file', 'watch' ],
    boolean: [ 'help', 'colors', 'list', 'force-esm', 'force-cjs' ],
    count: [ 'verbose', 'quiet' ],
  })

  /* ======================================================================== *
   * NORMALIZE YARGS ARGUMENTS                                                *
   * ======================================================================== */

  /* Our options */
  const tasks: string[] = []
  const props: Record<string, string> = {}
  const watchDirs: string[] = []
  let verbosity = 0 // yargs always returns 0 for count (quiet/verbose)
  let colors: boolean | undefined = undefined
  let file: string | undefined = undefined
  let forceEsm = false
  let forceCjs = false
  let listOnly = false
  let help = false

  /* Switcharoo on arguments */
  for (const [ key, value ] of Object.entries(parsed)) {
    switch (key) {
      case '_': // extra arguments
        value.forEach((current: string) => {
          const [ key, val ] = current.split(/=(.*)/, 2)
          if (val) props[key] = val
          else tasks.push(current)
        })
        break
      case 'verbose': // increase verbosity
        verbosity = verbosity + value
        break
      case 'quiet': // decrease verbosity
        verbosity = verbosity - value
        break
      case 'file': // build file
        file = value
        break
      case 'watch': // watch directory
        if (Array.isArray(value)) watchDirs.push(...value)
        else if (value) watchDirs.push(value)
        break
      case 'force-esm':
        forceEsm = !! value
        break
      case 'force-cjs':
        forceCjs = !! value
        break
      case 'colors':
        colors = !! value
        break
      case 'list':
        listOnly = !! value
        break
      case 'help':
        help = !! value
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
    console.log(`${$blu}${$und}Usage:${$rst}

    ${$wht}plugjs${$rst} ${$gry}[${$rst}--options${$gry}] [...${$rst}prop=val${$gry}] [...${$rst}tasks${$gry}]${$rst}

    ${$blu}${$und}Options:${$rst}

        ${$wht}-f --file ${$gry}${$und}file${$rst}  Specify the build file to use (default "./build.[ts/js/...]")
        ${$wht}-w --watch ${$gry}${$und}dir${$rst}  Watch for changes on the specified directory and run build
        ${$wht}-v --verbose${$rst}    Increase logging verbosity
        ${$wht}-q --quiet${$rst}      Decrease logging verbosity
        ${$wht}-c --colors${$rst}     Force colorful output (use "--no-colors" to force plain text)
        ${$wht}-l --list${$rst}       Only list the tasks defined by the build, nothing more!
        ${$wht}-h --help${$rst}       Help! You're reading it now!

    ${$blu}${$und}Properties:${$rst}

        Any argument in the format "key=value" will be interpeted as a property to
        be injected in the build process (e.g. "mode=production").

    ${$blu}${$und}Tasks:${$rst}

        Any other argument will be treated as a task name. If no task names are
        specified, the "default" task will be executed.

    ${$blu}${$und}Watch Mode:${$rst}

        The "-w" option can be specified multiple times, and each single directory
        specified will be watched for changes. Please note that Plug's own watch
        mode is incredibly basic, for more complex scenarios use something more
        advanced like nodemon (https://www.npmjs.com/package/nodemon).

    ${$blu}${$und}TypeScript module format:${$rst}

        Normally our TypeScript loader will transpile ".ts" files to the "type"
        specified in "package.json", either "commonjs" (the default) or "module".

        To force a specific module format we can use one of the following flags:

        ${$wht}--force-esm  ${$rst}   Force transpilation of ".ts" files to EcmaScript modules
        ${$wht}--force-cjs  ${$rst}   Force transpilation of ".ts" files to CommonJS modules
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
   * WATCH MODE                                                               *
   * ======================================================================== */

  console.log('WD', watchDirs)
  watchDirs.forEach((watchDir) => {
    const absolute = _path.resolve(watchDir)
    if (! isDir(absolute)) {
      console.log(`Specified watch directory "${watchDir}" was not found`)
      process.exit(1)
    } else {
      watchDir = absolute
    }
  })

  /* ======================================================================== *
   * FORCE MODULE TYPE                                                        *
   * ======================================================================== */

  if (forceEsm && forceCjs) {
    console.log('The "--force-cjs" and "--force-esm" flags can not coexist')
    process.exit(1)
  }

  const force = forceEsm ? 'module' : forceCjs ? 'commonjs' : undefined

  /* ======================================================================== *
   * ALL DONE                                                                 *
   * ======================================================================== */

  return { buildFile, watchDirs, tasks, props, listOnly, force }
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

/* Returns a boolean indicating whether the specified directory exists or not */
function isDir(path: string): boolean {
  try {
    return _fs.statSync(path).isDirectory()
  } catch (error) {
    return false
  }
}
