import { sep } from 'node:path'

import { Files } from '../files'
import { readFile, writeFile } from '../fs'
import { $p } from '../logging'
import { getAbsoluteParent } from '../paths'
import { install } from '../pipe'

import type { Context, PipeParameters, Plug } from '../pipe'

/** Options for our `exports` plug. */
export interface ExportsOptions {
  /** The `package.json` file used as the input for processing */
  packageJson?: string
  /** The `package.json` file to be written including the matching exports */
  outputPackageJson?: string
  /** The extension for CommonJS modules (default: `.cjs` or `.js`) */
  cjsExtension?: string
  /** The extension for EcmaScript modules (default: `.mjs` or `.js`) */
  esmExtension?: string
}

declare module '../index' {
  export interface Pipe {
    /** Include the files piped into this task as `exports` in `package.json` */
    exports(options?: ExportsOptions): Pipe
  }
}

/* ========================================================================== *
 * INSTALLATION / IMPLEMENTATION                                              *
 * ========================================================================== */

type ExportsDeclaration = {
  [ name in string ]? : {
    [ type in 'require' | 'import' ]? : {
      [ kind in 'types' | 'default' ]? : string
    }
  }
}

install('exports', class Exports implements Plug<Files> {
  private readonly _packageJson: string
  private readonly _outputPackageJson: string
  private readonly _cjsExtension?: string
  private readonly _esmExtension?: string

  constructor(...args: PipeParameters<'exports'>) {
    const options = args[0] || {}
    const {
      packageJson = 'package.json',
      outputPackageJson = packageJson,
      cjsExtension,
      esmExtension,
    } = options
    this._packageJson = packageJson,
    this._outputPackageJson = outputPackageJson
    this._cjsExtension = cjsExtension
    this._esmExtension = esmExtension
  }

  async pipe(files: Files, context: Context): Promise<Files> {
    // read up our package.json, we need it to figure out the default `type`
    const incomingFile = context.resolve(this._packageJson)
    const incomingData = await readFile(incomingFile, 'utf8')
    const packageData = JSON.parse(incomingData)

    // type here determines the extension of commonjs or ecmascript modules
    const type =
      packageData.type === 'module' ? 'module' :
      packageData.type === 'commonjs' ? 'commonjs' :
      packageData.type == null ? 'commonjs' :
      undefined
    if (! type) context.log.fail(`Unknown module type "${packageData.type}" in ${$p(incomingFile)}`)

    context.log.debug(`Package file ${$p(incomingFile)} declares module type "${type}"`)

    const cjsExtension = this._cjsExtension || (type === 'commonjs' ? '.js' : '.cjs')
    const esmExtension = this._esmExtension || (type === 'module' ? '.js' : '.mjs')

    // reject when commonjs and ecmascript modules have the same extension
    if (cjsExtension === esmExtension) {
      context.log.fail(`CommonJS and EcmaScript modules both resolve to same extension "${cjsExtension}"`)
    }

    const exports: ExportsDeclaration = {}
    function addExport(
        name: string,
        type: 'require' | 'import',
        kind: 'types' | 'default',
        file: string,
    ): void {
      if (! exports[name]) exports[name] = {}
      if (! exports[name]![type]) exports[name]![type] = {}
      exports[name]![type]![kind] = file
    }

    // all extensions to match in the incoming files
    const exts = [ '.d.mts', '.d.cts', '.d.ts', cjsExtension, esmExtension ]

    // look up all the files we were piped in
    for (const file of files) {
      for (const ext of exts) {
        if (! file.endsWith(ext)) continue

        const base = `.${sep}${file.slice(0, -ext.length)}`
        const name = base.endsWith(`${sep}index`) ? base.slice(0, -6) : base

        switch (ext) {
          case cjsExtension:
            addExport(name, 'require', 'default', `.${sep}dist${sep}${file}`)
            break
          case esmExtension:
            addExport(name, 'import', 'default', `.${sep}dist${sep}${file}`)
            break
          case '.d.cts':
            addExport(name, 'require', 'types', `.${sep}dist${sep}${file}`)
            break
          case '.d.mts':
            addExport(name, 'import', 'types', `.${sep}dist${sep}${file}`)
            break
          case '.d.ts':
            addExport(name, 'require', 'types', `.${sep}dist${sep}${file}`)
            addExport(name, 'import', 'types', `.${sep}dist${sep}${file}`)
            break
        }
      }
    }

    // correctly order the exports record (e.g. types comes before default)
    packageData['exports'] = Object.keys(exports).sort().reduce((obj, name) => {
      const current = exports[name]
      if (! current) return obj

      // json serialization will scrub all undefined... here we export the types
      // only if the "default" export is available, or we scrub the whole thing!
      obj[name] = current.require?.default || current.import?.default ? {
        require: current.require?.default ? {
          types: current.require.types || undefined,
          default: current.require.default || undefined,
        } : undefined,
        import: current.import?.default ? {
          types: current.import.types || undefined,
          default: current.import.default || undefined,
        } : undefined,
      } : undefined

      return obj
    }, {} as ExportsDeclaration)

    // convert back our package data into a json and write it
    const outgoingData = JSON.stringify(packageData, null, 2)
    const outgoingFile = context.resolve(this._outputPackageJson)
    context.log.info(`Writing new ${$p(outgoingFile)}`, outgoingData)
    await writeFile(outgoingFile, outgoingData, 'utf8')

    // return a `Files` instance with our `package.json` in there
    return Files.builder(getAbsoluteParent(outgoingFile)).add(outgoingFile).build()
  }
})
