#!/usr/bin/env node
/* eslint-disable no-console */

import { async, files, paths, pipe, utils, logging } from '@plugjs/plug'
import { main, yargsParser } from '@plugjs/tsrun'

import { Test } from './test'

const { $blu, $und, $gry, $wht } = logging
const $gnd = (s: string): string => $gry($und(s))
const $bnd = (s: string): string => $blu($und(s))
const $wnd = (s: string): string => $wht($und(s))


/** Version injected by esbuild, defaulted in case of dynamic transpilation */
const version = typeof __version === 'string' ? __version : '0.0.0-dev'
declare const __version: string | undefined

/* ========================================================================== *
 * HELP SCREEN                                                                *
 * ========================================================================== */

/** Show help screen */
function help(): void {
  console.log(`${$blu($und('Usage:'))}

  ${$wht('expect5')} ${$gry('[')}--options${$gry('] [...')}globs${$gry('...]')}

  ${$bnd('Options:')}

      ${$wht('-r --report ')} ${$gnd('dir')}    The directory where tests are to be found
      ${$wht('-m --minimum')} ${$gnd('num')}    The maximum number of failures to report
      ${$wht('-o --optimal')} ${$gnd('num')}    The maximum number of failures to report
      ${$wht('-h --help   ')}        Help! You're reading it now!
      ${$wht('   --version')}        Version! This one: ${version}!

  ${$bnd('Globs:')}

      Other arguments will be treated as globs, used to match test files in
      the specified directory (defaults to the current directory).

      If no globs are specified, the default will be ${$wnd('**/*.test.([cm])?([jt])s')}
      matching all JavaScript and TypeScript files with a ".test" prefix.

  ${$bnd('Environment Variables:')}

      ${$wht('LOG_LEVEL$      ')}    The default ${$wnd('notice')}, or ${$gnd('debug')}, ${$gnd('info')}, ${$gnd('warn')} or ${$gnd('error')}.
      ${$wht('NODE_V8_COVERAGE')}    The directory where Node will write coverage data to.

  ${$bnd('TypeScript module format:')}

      Normally our TypeScript loader will transpile ${$wnd('.ts')} files to the type
      specified in ${$wnd('package.json')}, either ${$wnd('commonjs')} (the default) or ${$wnd('module')}.

      To force a specific module format use one of the following flags:

      ${$wht('--force-esm')}    Force transpilation of ${$wnd('.ts')} files to EcmaScript modules
      ${$wht('--force-cjs')}    Force transpilation of ${$wnd('.ts')} files to CommonJS modules
`)
  process.exit(0)
}

/* ========================================================================== *
 * MAIN TEST RUNNER                                                           *
 * ========================================================================== */

/** Parse command line and run tests */
main(import.meta.url, async (args): Promise<void> => {
  const filename = paths.requireFilename(import.meta.url) // self, for context
  const context = new pipe.Context(filename, '') // context for pipes
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
    boolean: [ 'help', 'version' ],
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
  if (globs.length === 0) globs.push('**/*.test.([cm])?([jt])s')

  // Find all the test files to pass to Expect5
  const builder = files.Files.builder(directory)
  for await (const file of utils.walk(directory, globs)) builder.add(file)

  // Simply create the Test plug and pass everything to it
  try {
    process.exitCode = 0
    await async.runAsync(context, '', () => {
      return new Test({ maxFailures }).pipe(builder.build(), context)
    })
  } catch (error) {
    context.log.error(error)
    process.exit(1)
  }
})
