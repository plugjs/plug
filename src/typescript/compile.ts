import { createProgram, getPreEmitDiagnostics } from 'typescript'
import type { CompilerOptions } from 'typescript'
import { Files } from '../files'
import { log } from '../log'
import { Plug, PlugContext } from '../plug'
import { TypeScriptHost } from './compiler'
import { getCompilerOptions } from './options'


export class Compile implements Plug {
  #options?: CompilerOptions
  #config?: string

  /** ConstructorDoc w/ options */
  constructor(options?: CompilerOptions)
  /** ConstructorDoc w/ config */
  constructor(config?: string, options?: CompilerOptions)

  constructor(first: string | CompilerOptions | undefined, extra?: CompilerOptions) {
    const { config, options } =
      typeof first === 'string' ? { config: first, options: extra } :
      first === undefined ? { config: undefined, options: extra } :
      { config: undefined, options: first }

    this.#options = options
    this.#config = config
  }

  async pipe(files: Files, context: PlugContext): Promise<Files> {
    const host = new TypeScriptHost(context.resolve('.'))


    const { options, errors } = await getCompilerOptions()

    const paths = [ ...files.absolutePaths() ]
    for (const path of paths) log.trace(`Compiling "${path}"`)

    // Get our build file and create the master program
    log.info('Compiling', paths.length, 'files')

    const program = createProgram(paths, options, host, undefined, errors)
    const diagnostics = getPreEmitDiagnostics(program)
    host.checkDiagnostics(diagnostics)

    const result = program.emit(undefined, (fileName, code) => {
      log.info('Should write', fileName)
    })

    // Check for errors...
    host.checkDiagnostics(result.diagnostics)

    return context.files('.').build()
  }
}
