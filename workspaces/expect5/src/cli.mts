#!/usr/bin/env node

import { async, find, logging, paths, pipe } from '@plugjs/plug'
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
  // eslint-disable-next-line no-console
  console.log(`${$blu($und('Usage:'))}

  ${$wht('expect5')} ${$gry('[')}--options${$gry('] [...')}globs${$gry('...]')}

  ${$bnd('Options:')}

      ${$wht('-d --directory')} ${$gnd('dir')}    Directory where tests are to be found
      ${$wht('-h --help     ')}        Help! You're reading it now!
      ${$wht('   --version  ')}        Version! This one: ${version}!

  ${$bnd('Globs:')}

      Other arguments will be treated as globs, used to match test files in
      the specified directory (defaults to the current directory).

      If no globs are specified, the default will be to find all JavaScript
      and TypeScript files in the ${$wnd('./test')} directory, prefixed by the ${$wnd('.test')}
      extension ${$gry('(for example')} ${$und('foobar.test.ts')}${$gry(')')}.

  ${$bnd('Environment Variables:')}

      ${$wht('LOG_LEVEL       ')}    The default ${$wnd('notice')}, or ${$gnd('debug')}, ${$gnd('info')}, ${$gnd('warn')} or ${$gnd('error')}.
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
  logging.logOptions.spinner = false

  const filename = paths.requireFilename(import.meta.url) // self, for context
  const context = new pipe.Context(filename, '') // context for pipes
  let directory = '.' // default directory to CWD
  const globs: string[] = [] // empty globs list

  const parsed = yargsParser(args, {
    configuration: {
      'camel-case-expansion': false,
      'strip-aliased': true,
      'strip-dashed': true,
    },

    alias: {
      'directory': [ 'd' ],
      'help': [ 'h' ],
    },

    string: [ 'directory' ],
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
      case 'help':
        return help()
      case 'version':
        return context.log.notice(`Expect5 ${$gry('ver.')} ${$wnd(version)}`)
      default:
        context.log.error(`Unsupported option ${$wnd(key)} (try ${$wnd('--help')})`)
        process.exit(1)
    }
  }

  // Default glob (all .test.xx files in the test directory)
  const glob = globs.shift() || 'test/**/*.test.([cm])?[jt]s'

  // Simply create the Test plug and pass everything to it
  try {
    process.exitCode = 0
    await async.runAsync(context, '', () => {
      return find(glob, ...globs, { directory }).plug(new Test())
    })
  } catch (error) {
    context.log.error(error)
    process.exit(1)
  }
})
