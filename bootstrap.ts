import { build, files, find, fixExtensions, log, parallel, pipe } from './src/index'

const booststrap = build({
  find_sources: () => find('**/*.ts', { directory: 'src' }),

  async compile_sources() {
    const sources = await this.find_sources()

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
    return await this.find_sources()
        .esbuild({ outdir: 'build/test' })
  },

  async compile_types() {
    return await this.find_sources()
        .tsc('tsconfig.json', {
          noEmit: false,
          declaration: true,
          emitDeclarationOnly: true,
          outDir: './types',
        })
  },

  async lint_sources() {
    await this.find_sources().eslint()
  },

  async coverage() {
    await this.find_sources()
        .coverage('./coverage', {
          minimumCoverage: 0,
          optimalCoverage: 50,
          minimumFileCoverage: 0,
          optimalFileCoverage: 50,
        })
  },

  async default() {
    // await this.coverage()
    await parallel(
        this.lint_sources(),
        this.compile_types(),
        this.compile_sources(),
        this.compile_tests(),
    )
  },
})

booststrap.default()
    .then(() => log.info('All done!'))
    .catch((error) => log.error('Build error', error))
