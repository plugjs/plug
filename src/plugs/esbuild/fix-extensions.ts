import path from 'node:path'

import type { Plugin } from 'esbuild'

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

      /* Intercept resolution */
      build.onResolve({ filter: /.*/ }, async (args) => {
        /* Ignore the entry points (when the file is not being imported) */
        if (! args.importer) return null

        /* Anything not starting with "."? external node module */
        if (! args.path.startsWith('.')) return { external: true }

        /* Our ".js" extension, might be remapped by `outExtension`s */
        const js = build.initialOptions.outExtension?.['.js'] || '.js'

        /* Extensions for files to look for */
        const exts = build.initialOptions.resolveExtensions || [ '.ts', '.js', '.tsx', '.jsx' ]

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
