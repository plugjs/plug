#!/usr/bin/env node

import _fs from 'node:fs'
import _path from 'node:path'

import _yargs from 'yargs-parser'

import { $blu, $gry, $rst, $tsk, $und, $wht, isDirectory, isFile, main, version } from './utils.js'

import type { BuildFailure } from '../src/asserts.js'
import type { Build } from '../src/index.js'

/* ========================================================================== *
 * ========================================================================== *
 * PROCESS SETUP                                                              *
 * ========================================================================== *
 * ========================================================================== */

/* eslint-disable no-console */

/* We have everyhing we need to start our asynchronous main! */
async function cli(args: string[]): Promise<void> {
  // Parse and destructure command line
  const {
    buildFile,
    watchDirs,
    tasks,
    props,
    listOnly,
  } = parseCommandLine(args)

  // Default task if none specified
  if (tasks.length === 0) tasks.push('default')

  // Import and check build file
  let maybeBuild = await import(buildFile)
  while (maybeBuild) {
    if (isBuild(maybeBuild)) break
    maybeBuild = maybeBuild.default
  }

  // We _need_ a build
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

  // List tasks
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
    return
  }

  // Watch directories
  if (watchDirs.length) {
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
    return
  }

  // Normal build (no list, no watchers)
  try {
    await build[buildMarker](tasks, props)
  } catch (error) {
    if (! isBuildFailure(error)) console.log(error)
    process.exit(1)
  }
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
}

/** Parse `perocess.argv` and return our normalised command line options */
export function parseCommandLine(args: string[]): CommandLineOptions {
  /* Yargs-parse our arguments */
  const parsed = _yargs(args, {
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
    boolean: [ 'help', 'colors', 'list', 'force-esm', 'force-cjs', 'version' ],
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
  let listOnly = false
  let help = false

  /* Switcharoo on arguments */
  for (const [ key, value ] of Object.entries(parsed)) {
    switch (key) {
      case '_': // extra arguments
        value.forEach((current: string) => {
          const [ key, val ] = current.split(/=(.*)/, 2)
          if (key && val) props[key] = val
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
      case 'colors':
        colors = !! value
        break
      case 'list':
        listOnly = !! value
        break
      case 'help':
        help = !! value
        break
      case 'version':
        console.log(`v${version()}`)
        process.exit(0)
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
        ${$wht}   --version${$rst}    Version! This one: ${version()}!

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
    process.exit(0)
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

  watchDirs.forEach((watchDir) => {
    const absolute = _path.resolve(watchDir)
    if (! isDirectory(absolute)) {
      console.log(`Specified watch directory "${watchDir}" was not found`)
      process.exit(1)
    } else {
      watchDir = absolute
    }
  })

  /* ======================================================================== *
   * ALL DONE                                                                 *
   * ======================================================================== */

  return { buildFile, watchDirs, tasks, props, listOnly }
}

/* ========================================================================== *
 * ========================================================================== *
 * MAIN ENTRY POINT                                                           *
 * ========================================================================== *
 * ========================================================================== */

main(cli)
