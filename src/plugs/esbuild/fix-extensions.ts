import path from 'node:path'

import { Plugin } from 'esbuild'
import { assertAbsolutePath, resolveAbsolutePath, resolveFile } from '../../paths'
import { stat } from '../../utils/asyncfs'

/**
 * A simple ESBuild plugin fixing extensions for `require` and `import` calls.
 *
 * This can be useful when compiling dual-module packages (`esm` and `cjs`),
 * where the file module type is determined by the `.mjs` or `.cjs` extension.
 *
 * For example this will make sure all `import` statements use the `.mjs`
 * extensions, while all `require` use `.cjs`.
 *
 * ```
 * await find('*.ts', { directory: 'src' })
 *   .esbuild({
 *     outdir: 'dist',
 *     format: 'cjs',
 *     plugins: [ fixExtensions ],
 *     outExtension: { '.js': '.mjs' },
 *   })
 *
 * await find('*.ts', { directory: 'src' })
 *   .esbuild({
 *     outdir: 'dist',
 *     format: 'esm',
 *     plugins: [ fixExtensions ],
 *     outExtension: { '.js': '.mjs' },
 *   })
 * ```
 */
export function fixExtensions(): Plugin {
  return {
    name: 'fix-extensions',

    setup(build): void {
      /* When using this, we fake esbuild's "bundle" functionality */
      build.initialOptions.bundle = true

      /* Our ".js" extension, might be remapped by `outExtension`s */
      const cjs = build.initialOptions.outExtension?.['.cjs'] || '.cjs'
      const mjs = build.initialOptions.outExtension?.['.mjs'] || '.mjs'
      const js = build.initialOptions.outExtension?.['.js'] || '.js'

      /* Extensions for files to look for */
      const exts = build.initialOptions.resolveExtensions || [ '.ts', '.js', '.tsx', '.jsx' ]

      /* Intercept resolution */
      build.onResolve({ filter: /.*/ }, async (args) => {
        /* Ignore the entry points (when the file is not being imported) */
        if (! args.importer) return null

        /* Anything not starting with "."? external node module */
        if (! args.path.match(/^\.\.?\//)) return { external: true }

        /* Some easy pathing options */
        const resolveDir = args.resolveDir
        assertAbsolutePath(resolveDir)

        /* First of all, check if the _real_ filename exists */
        const resolved = resolveAbsolutePath(resolveDir, args.path)
        if (resolveFile(resolved)) return { path: args.path, external: true }

        /*
         * Thank you TypeScript 4.7!!! If the file is ".js", ".mjs" or ".cjs" we
         * need to check if we have the corresponding ".ts", ".mts" or ".cjs"
         * and return whatever ESBuild maps that particular extension to.
         */
        const match = args.path.match(/(.*)(\.[mc]?js$)/)
        if (match) {
          const [ , name, ext ] = match
          const tspath = name + ext.replace('js', 'ts')
          const tsfile = resolveAbsolutePath(resolveDir, tspath)
          if (resolveFile(tsfile)) {
            const newext = ext === '.mjs' ? mjs : ext === '.cjs' ? cjs : js
            return { path: name + newext, external: true }
          }
        }

        /* Check if ".../filename.ext" exists in our sources */
        for (const ext of exts) {
          const fileName = `${args.path}${ext}`
          const filePath = path.resolve(args.resolveDir, fileName)
          const isFile = await stat(filePath).then((stat) => stat.isFile(), (error) => void error)
          if (isFile) return { path: `${args.path}${js}`, external: true }
        }

        /* If ".../filename" is not a directory, we end here */
        const dirPath = path.resolve(args.resolveDir, args.path)
        const isDir = await stat(dirPath).then((stat) => stat.isDirectory(), (error) => void error)
        if (! isDir) return { external: true }

        /* Check if ".../filename/index.ext" exists in our sources */
        for (const ext of exts) {
          const fileName = path.join(args.path, `index${ext}`)
          const filePath = path.resolve(args.resolveDir, fileName)
          const isFile = await stat(filePath).then((stat) => stat.isFile(), (error) => void error)
          if (isFile) return { path: `${args.path}/index${js}`, external: true }
        }

        /* Nothing was found, then just mark this external */
        return { external: true }
      })
    },
  }
}
