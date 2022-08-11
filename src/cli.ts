/* eslint-disable no-console */

import { fork } from 'node:child_process'

import yargsParser from 'yargs-parser'
import { isBuildFailure } from './assert'

import { isBuild } from './build'
import { logLevels, logOptions, NOTICE } from './log'
import { AbsolutePath, getCurrentWorkingDirectory, isFile, requireFilename, resolveAbsolutePath } from './paths'

/* Yargs-parse our arguments */
const parsed = yargsParser(process.argv.slice(2), {
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

/* Our options */
const tasks: string[] = []
let verbosity = 0
let colors: boolean | undefined = undefined
let file: string | undefined = undefined
let list = false
let help = false

/* Switcharoo on arguments */
for (const key in parsed) {
  switch (key) {
    case '_': // extra arguments
      tasks.push(...parsed[key].map((s) => `${s}`))
      break
    case 'verbose': // increase verbosity
      verbosity += parsed[key]
      break
    case 'quiet': // decrease verbosity
      verbosity -= parsed[key]
      break
    case 'file': // build file
      file = parsed[key]
      break
    case 'colors':
      colors = !! parsed[key]
      break
    case 'list':
      list = !! parsed[key]
      break
    case 'help':
      help = !! parsed[key]
      break
    default:
      console.log(`Unsupported option "${key}" (try "--help")`)
      process.exit(1)
  }
}

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

/* Log colors */
if (colors != undefined) logOptions.colors = colors

/* Log level (from verbosity) */
const levels = Object.values(logLevels).sort()
let level = levels.indexOf(NOTICE) + verbosity
if (level >= levels.length) level = levels.length - 1
else if (level < 0) level = 0
logOptions.level = levels[level]

/* Build file */
const exts = [ 'ts', 'js', 'cjs', 'mjs' ]
const cwd = getCurrentWorkingDirectory()
let buildFile: AbsolutePath | undefined = undefined
if (file) {
  const absolute = resolveAbsolutePath(cwd, file)
  if (! isFile(absolute)) {
    console.log(`Specified build file "${file}" was not found`)
    process.exit(1)
  } else {
    buildFile = absolute
  }
} else {
  for (const ext of exts) {
    const absolute = resolveAbsolutePath(cwd, `build.${ext}`)
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

/* Make sure we have at least one task */
if (tasks.length === 0) tasks.push('default')

/* ========================================================================== *
 * LOAD BUILD, RUN TASKS                                                      *
 * -------------------------------------------------------------------------- *
 * NOTE: this will only run as a CJS module (for now)                         *
 * ========================================================================== */

/* We have everyhing we need to start our asynchronous main! */
async function main(buildFile: AbsolutePath, tasks: string[], list: boolean): Promise<void> {
  const exports =
      __cjs ? await require(buildFile) :
      __esm ? await import(buildFile) :
      undefined

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

  if (list) {
    console.log('Build file tasks\n- ' + Object.keys(build).sort().join('\n- '))
  } else {
    for (const task of tasks) await build[task]()
  }
}

/* Check for source maps and typescript support */
const sourceMapsEnabled = process.execArgv.indexOf('--enable-source-maps') >= 0

if (process.env.DEBUG_CLI === 'true') {
  console.log('SourceMaps enabled =', sourceMapsEnabled)
  console.log('   TS Loader (CJS) =', __tsLoaderCJS)
  console.log('   TS Loader (ESM) =', __tsLoaderESM)
  console.log('         Arguments =', process.argv.join(' '))
  console.log('               PID =', process.pid)
}

/* If both source maps and typescript are on, run! */
if (sourceMapsEnabled && __tsLoaderCJS && __tsLoaderESM) {
  main(buildFile, tasks, list)
      .then(() => process.exit(0))
      .catch((error) => {
        if (! isBuildFailure(error)) console.log(error)
        process.exit(1)
      })
} else {
  /* Fork out ourselves with new options */
  const execArgv = [ ...process.execArgv ]

  /* Enable source maps if not done already */
  if (! sourceMapsEnabled) execArgv.push('--enable-source-maps')

  /* Enable our CJS TypeScript loader if not done already */
  if (! global.__tsLoaderCJS) {
    const tsLoaderCJS = requireFilename(__fileurl, '../extra/ts-loader.cjs')
    execArgv.push(`--require=${tsLoaderCJS}`)
  }

  /* Enable our ESM TypeScript loader if not done already */
  if (! global.__tsLoaderESM) {
    const tsLoaderESM = requireFilename(__fileurl, '../extra/ts-loader.mjs')
    execArgv.push(`--experimental-loader=${tsLoaderESM}`, '--no-warnings')
  }

  /* Fork ourselves! */
  const script = requireFilename(__fileurl) // self
  const child = fork(script, [ ...process.argv.slice(2) ], {
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
