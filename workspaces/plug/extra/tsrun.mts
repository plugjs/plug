#!/usr/bin/env node
/* eslint-disable no-console */

import _path from 'node:path'

import { $blu, $gry, $rst, $und, $wht, main, version } from './utils.js'

/** Our minimalistic help */
function help(): never {
  console.log(`${$blu}${$und}Usage:${$rst}

  ${$wht}tsrun${$rst} ${$gry}[${$rst}--options${$gry}] script.ts [...${$rst}script args${$gry}]${$rst}

  ${$blu}${$und}Options:${$rst}

      ${$wht}-h --help${$rst}       Help! You're reading it now!
      ${$wht}-v --version${$rst}    Version! This one: ${version()}!
      ${$wht}   --force-esm${$rst}  Force transpilation of ".ts" files to EcmaScript modules
      ${$wht}   --force-cjs${$rst}  Force transpilation of ".ts" files to CommonJS modules

  ${$blu}${$und}Description:${$rst}

      ${$wht}tsrun${$rst} is a minimalistic TypeScript loader, using "esbuild" to transpile TS
      code to JavaScript, and running it. Being extremely un-sofisticated, it's
      not meant to to be in any way a replacement for more complete alternatives
      like "ts-node".
`)

  process.exit(1)
}

/** Process the command line */
main((args: string[]): void => {
  let script: string | undefined
  let scriptArgs: string[] = []

  // Parse options, leaving script and scriptArgs with our code to run
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if ((arg === '-h') || (arg === '--help')) help()
    if ((arg === '-v') || (arg === '--version')) {
      console.log(`v${version()}`)
      process.exit(1)
    }

    if (arg!.startsWith('-')) {
      console.log(`${$wht}tsrun${$rst}: Uknown option "${$wht}${arg}${$rst}"`)
      process.exit(1)
    }

    ([ script, ...scriptArgs ] = args.slice(i))
    break
  }

  // No script? Then help
  if (! script) help()

  // Resolve the _full_ path of the script, and tweak our process.argv
  // arguments, them simply import the script and let Node do its thing...
  script = _path.resolve(process.cwd(), script)
  process.argv = [ process.argv0, script, ...scriptArgs ]
  import(script)
})
