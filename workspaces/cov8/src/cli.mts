#!/usr/bin/env node

import { async, find, paths, pipe, logging, mkdtemp, rmrf, utils } from '@plugjs/plug'
import { main, yargsParser } from '@plugjs/tsrun'

import { Coverage } from './coverage'

const { $blu, $und, $gry, $wht, $p } = logging
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

  ${$wht('cov8')} ${$gry('[')}--options${$gry('] [--] [...')}command${$gry('...]')}

  ${$bnd('Options:')}

      ${$wht('-c --coverage-dir')} ${$gnd('dir')}    The directory containing all coverage data files
      ${$wht('-r --report-dir')} ${$gnd('dir')}      Write an HTML report to this directory
      ${$wht('-d --source-dir')} ${$gnd('dir')}      The directory where source files are located
      ${$wht('-s --sources')} ${$gnd('glob')}        A glob for the sources to be reported upon
      ${$wht('-m --minimum')} ${$gnd('num')}         The desired minimum coverage level to achieve
      ${$wht('-o --optimal')} ${$gnd('num')}         The desired optimal coverage level to achieve
      ${$wht('-h --help   ')}             Help! You're reading it now!
      ${$wht('   --version')}             Version! This one: ${version}!


  ${$bnd('Usave:')}

      This utility can process and create reports for ${$und('existing')} Node.js coverage
      data, or execute a command and verify the execution's coverage.

      When a command is not specified, the ${$wht('--coverage-dir')} option must be
      specified, and point to a directory containing one or more Node.js JSON
      coverage files. Those can be generated running node and specifying the
      ${$wnd('NODE_V8_COVERAGE')} environment variable.

      When a command is specified, the command will be executed, and coverage
      will be collected automatically in a temporary directory (or in the
      directory specified by ${$wht('--coverage-dir')}).

      The sources to report upon can be specified with the ${$wht('--source-dir')} option,
      indicating the directory where sources can be found (defailts to the current
      directory) and the ${$wht('--sources')} option (can be specified multiple times)
      indicating the globs matching the source files to report upon.

      The default is to report upon all JavaScript and TypeScript files in the
      ${$wnd('./src')} directory.

  ${$bnd('Environment Variables:')}

      ${$wht('LOG_LEVEL$      ')}    The default ${$wnd('notice')}, or ${$gnd('debug')}, ${$gnd('info')}, ${$gnd('warn')} or ${$gnd('error')}.

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
  const command: string[] = [] // empty command line
  const globs: string[] = [] // empty globs list
  let minimumCoverage: number | undefined = undefined
  let optimalCoverage: number | undefined = undefined
  let coverageDir: string | undefined
  let reportDir: string | undefined
  let sourceDir: string | undefined

  const parsed = yargsParser(args, {
    configuration: {
      'camel-case-expansion': false,
      'halt-at-non-option': true,
      'strip-aliased': true,
      'strip-dashed': true,
    },

    alias: {
      'coverage-dir': [ 'c' ],
      'report-dir': [ 'r' ],
      'source-dir': [ 'd' ],
      'minimum': [ 'm' ],
      'optimal': [ 'o' ],
      'sources': [ 's' ],
      'help': [ 'h' ],
    },

    string: [ 'coverage-dir', 'report-dir', 'source-dir', 'sources' ],
    number: [ 'minimum', 'optimal' ],
    boolean: [ 'help', 'version' ],
  })

  for (const [ key, value ] of Object.entries(parsed)) {
    switch (key) {
      case '_': // extra command line as args
        command.push(...value)
        break
      case 'coverage-dir':
        coverageDir = value
        break
      case 'report-dir':
        reportDir = value
        break
      case 'source-dir':
        sourceDir = value
        break
      case 'sources':
        globs.push(value)
        break
      case 'minimum':
        minimumCoverage = value
        break
      case 'optimal':
        optimalCoverage = value
        break
      case 'help':
        return help()
      case 'version':
        return context.log.notice(`Cov8 ${$gry('ver.')} ${$wnd(version)}`)
      default:
        context.log.error(`Unsupported option ${$wnd(key)} (try ${$wnd('--help')})`)
        process.exit(1)
    }
  }

  // Extra check for command or coverage dir requirement
  if ((command.length === 0) && (! coverageDir)) {
    context.log.error(`Either ${$wnd('--coverage-dir')} or a command must me specified`)
    process.exit(1)
  }

  // Default glob (all JS/TS in the 'src' directory)
  const glob = globs.shift() || '**/*.([cm])?[jt]s'
  const ignore = '**/*.d.([cm])?ts' // ignore .d.ts!

  // Simply create the Test plug and pass everything to it
  try {
    process.exitCode = 0
    await async.runAsync(context, '', async () => {
      let tempDir: string | undefined = undefined
      if (! coverageDir) {
        const directory = mkdtemp()
        context.log.notice(`Writing coverage data in ${$p(directory)}`)
        coverageDir = tempDir = directory
      }

      try {
        const [ cmd, ...args ] = command
        if (cmd) {
          const env = {
            ...process.env,
            ...logging.logOptions.forkEnv(),
          }
          await utils.execChild(cmd, args, { coverageDir, env }, context)
        }

        await find(glob, ...globs, { directory: sourceDir || 'src', ignore })
            .plug(new Coverage(coverageDir, {
              reportDir: reportDir as string,
              minimumCoverage,
              optimalCoverage,
            }))
      } finally {
        if (tempDir) await rmrf(tempDir)
      }
    })
  } catch (error) {
    context.log.error(error)
    process.exitCode = 1
  }
})
