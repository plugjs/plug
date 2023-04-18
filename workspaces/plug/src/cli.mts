#!/usr/bin/env node
/* eslint-disable no-console */

import _fs from 'node:fs'

import { main, yargsParser } from '@plugjs/tsrun'

import { BuildFailure } from './asserts'
import { invokeTasks, isBuild } from './build'
import { $blu, $gry, $p, $red, $t, $und, $wht } from './logging/colors'
import { getCurrentWorkingDirectory, resolveDirectory, resolveFile } from './paths'

import type { AbsolutePath } from './paths'

/* Extra colors */
const $bnd = (s: string): string => $blu($und(s))
const $gnd = (s: string): string => $gry($und(s))
const $wnd = (s: string): string => $wht($und(s))

/** Version injected by esbuild, defaulted in case of dynamic transpilation */
const version = typeof __version === 'string' ? __version : '0.0.0-dev'
declare const __version: string | undefined

/* ========================================================================== *
 * PARSE COMMAND LINE ARGUMENTS                                               *
 * ========================================================================== */

/* Parsed and normalised command line options */
interface CommandLineOptions {
  buildFile: AbsolutePath,
  watchDirs: string[],
  tasks: string[],
  props: Record<string, string>
  listOnly: boolean,
}

/** Parse `perocess.argv` and return our normalised command line options */
export function parseCommandLine(args: string[]): CommandLineOptions {
  /* Yargs-parse our arguments */
  const parsed = yargsParser(args, {
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
        console.log(`v${version}`)
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
    console.log(`${$bnd('Usage:')}

    ${$wht('plugjs')} ${$gry('[')}--options${$gry('] [... ')}prop=val${$gry(' ...] [... ')}task${$gry(' ...]')}

    ${$bnd('Options:')}

        ${$wht(`-f --file ${$gnd('file')}`)}  Specify the build file to use (default ${$wnd('./build.ts')})
        ${$wht(`-w --watch ${$gnd('dir')}`)}  Watch for changes on the specified directory and run
        ${$wht('-v --verbose')}    Increase logging verbosity
        ${$wht('-q --quiet')}      Decrease logging verbosity
        ${$wht('-c --colors')}     Force colorful output (use ${$wnd('--no-colors')} to force plain text)
        ${$wht('-l --list')}       Only list the tasks defined by the build, nothing more!
        ${$wht('-h --help')}       Help! You're reading it now!
        ${$wht('   --version')}    Version! This one: ${version}!

    ${$bnd('Properties:')}

        Any argument in the format ${$wnd('key=value')} will be interpeted as a property to
        be injected in the build process (e.g. ${$wnd('mode=production')}).

    ${$bnd('Tasks:')}

        Any other argument will be treated as a task name. If no task names are
        specified, the ${$t('default')} task will be executed.

    ${$bnd('Watch Mode:')}

        The ${$wnd('--watch')} option can be specified multiple times, and each single
        directory specified will be watched for changes. Note that Plug's own
        watch mode is incredibly basic, for more complex scenarios use something
        more advanced like nodemon ${$gry('(')}${$gnd('https://www.npmjs.com/package/nodemon')}${$gry(')')}.

    ${$bnd('TypeScript module format:')}

        Normally our TypeScript loader will transpile ${$wnd('.ts')} files to the type
        specified in ${$wnd('package.json')}, either ${$wnd('commonjs')} (the default) or ${$wnd('module')}.

        To force a specific module format use one of the following flags:

        ${$wht('--force-esm')}    Force transpilation of ${$wnd('.ts')} files to EcmaScript modules
        ${$wht('--force-cjs')}    Force transpilation of ${$wnd('.ts')} files to CommonJS modules
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
  const cwd = getCurrentWorkingDirectory()
  const exts = [ 'ts', 'mts', 'mjs', 'js', 'mjs', 'cjs' ]

  let buildFile: AbsolutePath | undefined = undefined

  if (file) {
    const absolute = resolveFile(cwd, file)
    if (! absolute) {
      console.log(`Specified build file "${file}" was not found`)
      process.exit(1)
    } else {
      buildFile = absolute
    }
  } else {
    for (const ext of exts) {
      const absolute = resolveFile(cwd, `build.${ext}`)
      if (! absolute) continue
      buildFile = absolute
      break
    }
  }

  /* Final check */
  if (! buildFile) {
    console.log(`${$red('Unable to find build file')} ${$wht(`./build.[${exts.join('|')}]`)}`)
    process.exit(1)
  }

  /* ======================================================================== *
   * WATCH MODE                                                               *
   * ======================================================================== */

  watchDirs.forEach((watchDir) => {
    const absolute = resolveDirectory(cwd, watchDir)
    if (! absolute) {
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
 * MAIN ENTRY POINT                                                           *
 * ========================================================================== */

main(import.meta.url, async (args: string[]): Promise<void> => {
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
    console.log($red('Build file did not export a proper build'))
    console.log()
    console.log('- If using CommonJS export your build as "module.exports"')
    console.log(`  e.g.: ${$wht('module.exports = build({ ... })')}`)
    console.log()
    console.log('- If using ESM modules export your build as "default"')
    console.log(`  e.g.: ${$wht('export default build({ ... })')}`)
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

    console.log(`\n${$gry('Outline of')} ${$p(buildFile)}`)

    console.log('\nKnown tasks:\n')
    for (const taskName of taskNames.sort()) {
      console.log(` ${$gry('\u25a0')} ${$t(taskName)}`)
    }

    console.log('\nKnown properties:\n')
    for (const propName of propNames.sort()) {
      const value = build[propName] ?
        ` ${$gry('(default')} ${$und(build[propName])}${$gry(')')}` : ''
      console.log(` ${$gry('\u25a1')} ${$blu(propName)}${value}`)
    }

    console.log()
    return
  }

  // Watch directories
  if (watchDirs.length) {
    return new Promise((_, reject) => {
      // filesystems change trigger a new run after 250 ms a change is detected,
      // in order to give time to editors to save a bunch of files open and
      // modified at the same time...
      let timeout: NodeJS.Timeout | undefined = undefined

      // our runner executed by the timeout
      const runme = (): void => {
        invokeTasks(build, tasks, props)
            .then(() => {
              console.log(`\n${$gry('Watching for files change...')}\n`)
            }, (error) => {
              if (error instanceof BuildFailure) {
                console.log(`\n${$gry('Watching for files change...')}\n`)
              } else {
                watchers.forEach((watcher) => watcher.close())
                reject(error)
              }
            })
            .finally(() => {
              timeout = undefined
            })
      }

      // watch all directories and trigger a run after 250 milliseconds
      const watchers = watchDirs.map((watchDir) => {
        return _fs.watch(watchDir, { recursive: true }, () => {
          if (! timeout) timeout = setTimeout(runme, 250)
        })
      })

      // start a build immediately on first run
      runme()
    })
  }

  // Normal build (no list, no watchers)
  try {
    await invokeTasks(build, tasks, props)
  } catch (error) {
    if (!(error instanceof BuildFailure)) console.log(error)
    process.exitCode = 1
  }
})
