#!/usr/bin/env node
/* eslint-disable no-console */

import { files, paths, pipe, utils, logging } from '@plugjs/plug'
import {
  $blu,
  $gry,
  $rst,
  $und,
  $wht,
  main,
  yargsParser,
} from '@plugjs/tsrun'

import { Test } from './test'

/** Version injected by esbuild, defaulted in case of dynamic transpilation */
const version = typeof __version === 'string' ? __version : '0.0.0-dev'
declare const __version: string | undefined

/* ========================================================================== *
 * HELP SCREEN                                                                *
 * ========================================================================== */

/** Show help screen */
function help(): void {
  console.log(`${$blu}${$und}Usage:${$rst}

  ${$wht}expect5${$rst} ${$gry}[${$rst}--options${$gry}] [...${$rst}globs${$gry}]${$rst}

  ${$blu}${$und}Options:${$rst}

      ${$wht}-d --directory ${$gry}${$und}dir${$rst}     The directory where tests are to be found
      ${$wht}-f --max-failures ${$gry}${$und}num${$rst}  The maximum number of failures to report
      ${$wht}-h --help             ${$rst} Help! You're reading it now!
      ${$wht}   --version          ${$rst} Version! This one: ${version}!

  ${$blu}${$und}Globs:${$rst}

      Other arguments will be treated as globs, used to match test files in
      the specified directory (defaults to the current directory).

      If no globs are specified, the default will be ${$wht}${$und}**/*.test.([cm])?([jt])s${$rst}
      matching all JavaScript and TypeScript files with a ".test" prefix.

  ${$blu}${$und}Environment Variables:${$rst}

      ${$wht}LOG_LEVEL${$rst}         The default ${$wht}${$und}notice${$rst}, or ${$gry}${$und}debug${$rst}, ${$gry}${$und}info${$rst}, ${$gry}${$und}warn${$rst} or ${$gry}${$und}error${$rst}.
      ${$wht}NODE_V8_COVERAGE${$rst}  The directory where Node will write coverage data to.

  ${$blu}${$und}TypeScript module format:${$rst}

      Normally our TypeScript loader will transpile ".ts" files to the "type"
      specified in "package.json", either "commonjs" (the default) or "module".

      To force a specific module format we can use one of the following flags:

      ${$wht}--force-esm  ${$rst}   Force transpilation of ".ts" files to EcmaScript modules
      ${$wht}--force-cjs  ${$rst}   Force transpilation of ".ts" files to CommonJS modules
  `)
  process.exit(0)
}

/* ========================================================================== *
 * MAIN TEST RUNNER                                                           *
 * ========================================================================== */

/** Parse command line and run tests */
main(import.meta.url, async (args): Promise<void> => {
  logging.logOptions.defaultTaskName = 'expect5'
  const filename = paths.requireFilename(import.meta.url) // self, for context
  const context = new pipe.Context(filename, 'expect5') // context for pipes
  let directory = context.resolve('.') // default directory to CWD
  let maxFailures: number = Infinity // no max failures
  const globs: string[] = [] // empty globs list

  const parsed = yargsParser(args, {
    configuration: {
      'camel-case-expansion': false,
      'strip-aliased': true,
      'strip-dashed': true,
    },

    alias: {
      'directory': [ 'd' ],
      'max-failures': [ 'f' ],
      'help': [ 'h' ],
    },

    string: [ 'directory' ],
    number: [ 'max-failures' ],
    boolean: [ 'help', 'version', 'force-esm', 'force-cjs' ],
  })

  for (const [ key, value ] of Object.entries(parsed)) {
    switch (key) {
      case '_': // globs as args
        globs.push(...value)
        break
      case 'directory':
        directory = context.resolve(value)
        break
      case 'max-failures':
        maxFailures = value
        break
      case 'help':
        return help()
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

  // Default glob is "'**/*.test.ts'"
  if (globs.length === 0) globs.push('**/*.test.ts')

  // Find all the test files to pass to Expect5
  const builder = files.Files.builder(directory)
  for await (const file of utils.walk(directory, globs)) builder.add(file)

  // Simply create the Test plug and pass everything to it
  try {
    process.exitCode = 0
    await new Test({ maxFailures }).pipe(builder.build(), context)
  } catch (error) {
    context.log.error(error)
    process.exit(1)
  }
})
