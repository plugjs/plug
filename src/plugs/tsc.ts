import type { CompilerOptions } from 'typescript'

import ts from 'typescript' // TypeScript does NOT support ESM modules

import { fail } from 'assert'
import { Files } from '../files'
import { $p, log } from '../log'
import { isFile } from '../paths'
import { install, Plug } from '../pipe'
import { Run } from '../run'
import { ParseOptions, parseOptions } from '../utils/options'
import { TypeScriptHost } from './tsc/compiler'
import { getCompilerOptions } from './tsc/options'


export class Tsc implements Plug<Files> {
  private readonly _tsconfig?: string
  private readonly _options: CompilerOptions

  constructor()
  constructor(config: string)
  constructor(options: CompilerOptions)
  constructor(config: string, options: CompilerOptions)

  constructor(...args: ParseOptions<CompilerOptions>) {
    const { params: [ tsconfig ], options } = parseOptions(args, {})
    this._tsconfig = tsconfig
    this._options = options
  }

  async pipe(files: Files, run: Run): Promise<Files> {
    const tsconfig =
      this._tsconfig ? run.resolve(this._tsconfig) :
        await isFile(files.directory, 'tsconfig.json')

    const overrides: CompilerOptions = {
      rootDir: files.directory, // by default, our "files" directory
      ...this._options, // any other options specified in the constructor
    }

    const { errors, options } = await getCompilerOptions(
        tsconfig, // resolved tsconfig.json from constructor, might be undefined
        overrides, // overrides from constructor, might be an empty object
        run.buildFile) // overrides are defined in the build file, sooo.....

    const { rootDir, outDir } = options
    const root = rootDir ? run.resolve(rootDir) : files.directory
    const out = outDir ? run.resolve(outDir) : root

    const host = new TypeScriptHost(root, run.log)

    const paths = [ ...files.absolutePaths() ]
    for (const path of paths) log.trace(`Compiling "${path}"`)

    // Get our build file and create the master program
    log.info('Compiling', paths.length, 'files')
    log.debug('Compliation options', options)

    const program = ts.createProgram(paths, options, host, undefined, errors)
    const diagnostics = ts.getPreEmitDiagnostics(program)
    host.checkDiagnostics(diagnostics)

    const builder = run.files(out)
    const promises: Promise<void>[] = []
    const result = program.emit(undefined, (fileName, code) => {
      promises.push(builder.write(fileName, code).then((file) => {
        log.trace('Written', $p(file))
      }))
    })

    // Check for errors...
    host.checkDiagnostics(result.diagnostics)

    const settlements = await Promise.allSettled(promises)
    for (const settlement of settlements) {
      if (settlement.status === 'rejected') fail('Error writing files')
    }

    const outputs = builder.build()
    log.info('TSC produced', outputs.length, 'files into', $p(outputs.directory))
    return outputs
  }
}

/* ========================================================================== *
 * INSTALLATION                                                               *
 * ========================================================================== */

install('tsc', Tsc)

declare module '../pipe' {
  export interface Pipe {
    tsc: PipeExtension<typeof Tsc>
  }
}
