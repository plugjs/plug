import { build, checkDependencies, find, fixExtensions, merge, parallel, rmrf } from './src/index'

export default build({
  find_sources: () => find('**/*.ts', { directory: 'src' }),
  find_tests: () => find('**/*.ts', { directory: 'test' }),

  /* ======================================================================== *
   * COMPILE AND RUN TESTS IN "./build"                                       *
   * ======================================================================== */

  async test() {
    await rmrf('.coverage-data')

    await this.find_tests().mocha({
      coverageDir: '.coverage-data',
    })
  },

  /* ======================================================================== *
   * EXTRA CHECKS (dependencies, linting, coverage)                           *
   * ======================================================================== */

  async dependencies() {
    await parallel([
      await this.find_sources().esbuild({
        plugins: [ checkDependencies({
          allowDev: false,
          allowUnused: false,
          ignored: [ 'yargs-parser' ],
        }) ],
        allowOverwrite: false,
        write: false,
        outdir: '.',
      }),
      await this.find_tests().esbuild({
        plugins: [ checkDependencies({
          allowDev: true,
          allowUnused: true,
        }) ],
        allowOverwrite: false,
        write: false,
        outdir: '.',
      }),
    ])
  },

  async coverage() {
    try {
      await this.test()
    } finally {
      await this.find_sources().coverage('.coverage-data', {
        reportDir: 'coverage',
      })
    }
  },

  async eslint() {
    await merge([
      this.find_sources(),
      this.find_tests(),
    ]).eslint()
  },

  async checks() {
    await parallel([
      this.dependencies(),
      this.coverage(),
      this.eslint(),
    ])
  },

  /* ======================================================================== *
   * COMPILE TYPES IN "./types" AND SOURCES IN "./dist" (esm and cjs)         *
   * ======================================================================== */

  async compile_cjs() {
    await this.find_sources().esbuild({
      outdir: 'dist',
      format: 'cjs',
      outExtension: { '.js': '.cjs' },
      sourcemap: 'linked',
      sourcesContent: false,
      plugins: [ fixExtensions() ],
      define: {
        __fileurl: '__filename',
        __esm: 'false',
        __cjs: 'true',
      },
    })
  },

  async compile_mjs() {
    await this.find_sources().esbuild({
      outdir: 'dist',
      format: 'esm',
      outExtension: { '.js': '.mjs' },
      sourcemap: 'linked',
      sourcesContent: false,
      plugins: [ fixExtensions() ],
      define: {
        __fileurl: 'import.meta.url',
        __esm: 'true',
        __cjs: 'false',
      },
    })
  },

  async copy_resources() {
    await find('!**/*.ts', { directory: 'src' })
        .copy('dist')
  },

  async compile_types() {
    await rmrf('types')

    const extra = find('**/*.d.ts', { directory: 'extra' })
    const sources = this.find_sources()

    return merge([ extra, sources ]).tsc('tsconfig.json', {
      rootDir: 'src', // root this in "src" (filters out "extra/...")
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      outDir: './types',
    })
  },

  async compile() {
    await rmrf('dist')

    await parallel([
      this.copy_resources(),
      this.compile_cjs(),
      this.compile_mjs(),
      this.compile_types(),
    ])
  },

  /* ======================================================================== *
   * DEFAULT TASK                                                             *
   * ======================================================================== */

  async default() {
    await this.compile()
    try {
      await this.test()
    } finally {
      await this.checks()
    }
  },
})
