import { Files, FilesBuilder } from '../files'
import type { Plug } from '../pipe'
import type { Run } from '../run'
import * as esb from 'esbuild'
import assert from 'assert'
import path from 'path'
import { $p, log } from '../log'

export class ESBuild implements Plug {
  #options: esb.BuildOptions

  constructor(options: esb.BuildOptions) {
    this.#options = options
  }

  async pipe(run: Run, files: Files): Promise<Files> {
    const options = { ...this.#options }

    options.absWorkingDir = files.directory
    options.entryPoints = [ ...files ]
    options.target = 'node16' // TODO
    options.format = 'cjs' // TODO

    let builder: FilesBuilder
    if (options.bundle) {
      throw new Error('Not yet bundling')
    } else {
      assert(options.outdir, 'Option "outdir" must be specified when not bundling')
      builder = Files.builder(run, options.outdir)
      options.outdir = builder.directory
      log.debug('Transpiling', files.length, 'files to', $p(builder.directory))
    }

    const { metafile } = await esb.build({ ...options, metafile: true })
    const outputs = metafile.outputs

    for (const file in outputs) {
      const source = path.resolve(files.directory, outputs[file].entryPoint!)
      const target = path.resolve(files.directory, file)
      log.trace('Transpiled', $p(source), 'to', $p(target))
      builder.add(target)
    }

    const result = builder.build()
    log.info('ESBuild produced', result.length, 'files into', $p(result.directory))
    return result

    // throw new Error('Method not implemented.')
  }
}
