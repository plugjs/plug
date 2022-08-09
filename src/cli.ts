/* eslint-disable no-console */
import { buildSync } from 'esbuild'

import yargsParser from 'yargs-parser'

import { Build, isBuild } from './build'
import { LogLevel, logLevels, logOptions } from './log'
import { AbsolutePath, getCurrentWorkingDirectory, isFile, resolveAbsolutePath } from './paths'
import { buildFailed } from './symbols'

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

/* Log colors and verbosity */
if (colors != undefined) logOptions.colors = colors

const levels = Object.entries(logLevels)
    .sort(([ , l1 ], [ , l2 ]) => l2 - l1)
    .map(([ level ]) => level as LogLevel)
let level = levels.indexOf('NOTICE') + verbosity
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
 * HACK BEYOND REDEMPTION: TRANSPILE .ts FILES                                *
 * ========================================================================== */

/* Inject only if we are _not_ running in "ts-node" */
import nodeModule from 'module'
const _module = nodeModule as any

if (! ('.ts' in _module._extensions)) {
  _module._extensions['.ts'] = (_mod: any, filename: string): void => {
    const result = buildSync({
      entryPoints: [ filename ],
      sourcemap: 'inline',
      platform: 'node',
      target: `node${process.versions['node']}`,
      format: 'cjs',
      write: false,
    })

    if (result.outputFiles.length !== 1) {
      throw new Error(`ESBuild produced ${result.outputFiles.length} files`)
    }

    _mod._compile(result.outputFiles[0].text, filename)
  }
}

/* ========================================================================== *
 * LOAD BUILD, RUN TASKS                                                      *
 * ========================================================================== */

/* We have everyhing we need to start our asynchronous main! */
async function main(buildFile: AbsolutePath, tasks: string[], list: boolean): Promise<void> {
  const exports = buildFile.endsWith('.mjs') ? await import(buildFile) : require(buildFile)

  const build: Build<any> | undefined = isBuild(exports) ? exports :
    'default' in exports && isBuild(exports.default) ? exports.default :
    undefined

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

/* Run now! */
main(buildFile, tasks, list).then(() => process.exit(0)).catch((error) => {
  if (error !== buildFailed) console.log(error)
  process.exit(1)
})
