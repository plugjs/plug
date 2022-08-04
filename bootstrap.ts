import { build, log, find, parallel, pipe, files, fixExtensions } from './src/index'


const booststrap = build({
  async compile_sources() {
    const sources = await find('**/*.ts', { directory: 'src' })

    const cjs = await pipe(sources)
        .esbuild({
          outdir: 'dist',
          format: 'cjs',
          plugins: [ fixExtensions ],
        })

    const esm = await pipe(sources)
        .esbuild({
          outdir: 'dist',
          format: 'esm',
          plugins: [ fixExtensions ],
          outExtension: { '.js': '.mjs' },
          define: { __filename: 'import.meta.url' },
        })

    return files('dist').merge(cjs, esm).build()
  },

  async compile_tests() {
    return find('**/*.ts', { directory: 'test' })
        .esbuild({ outdir: 'build/test' })
  },

  async compile_types() {
    return find('**/*.ts', { directory: 'src' })
        .tsc('tsconfig.json', {
          noEmit: false,
          declaration: true,
          emitDeclarationOnly: true,
          outDir: './types',
        })
  },

  async default() {
    await this.compile_types()
    await new Promise((resolve) => setTimeout(resolve, 5000))
    await parallel(
        this.compile_sources(),
        this.compile_tests(),
    )
  },
})

booststrap.default()
    .then(() => log.info('All done!'))
    .catch((error) => log.error('Build error', error))
