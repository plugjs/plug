import { $t, build, find, fixExtensions, log, merge, Pipe, rmrf } from './src/index.js'

/** When `true` the coverage dir comes from the environment */
const environmentCoverage = !! process.env.NODE_V8_COVERAGE

export default build({
  /** The coverage data dir, might be supplied as an env variable  */
  coverageDir: process.env.NODE_V8_COVERAGE || '.coverage-data',

  find_sources: () => find('**/*.ts', { directory: 'src', ignore: '**/*.d.ts' }),

  find_tests: () => find('**/*.ts', { directory: 'test', ignore: '**/*.d.ts' }),

  /* ======================================================================== *
   * RUN TESTS FROM "./test"                                                  *
   * ======================================================================== */

  async test() {
    if (environmentCoverage) {
      log.notice(`External coverage enabled, re-run task ${$t('coverage')} to generate full report`)
    } else {
      await rmrf(this.coverageDir)
    }

    await this.find_tests().mocha({
      coverageDir: this.coverageDir,
      require: './test/.setup.ts',
    })
  },

  /* ======================================================================== *
   * EXTRA CHECKS (dependencies, linting, coverage)                           *
   * ======================================================================== */

  async coverage() {
    try {
      await this.find_sources().coverage(this.coverageDir, {
        reportDir: 'coverage',
      })
    } catch (error) {
      if (! environmentCoverage) throw error
    }
  },

  async eslint() {
    await merge([
      this.find_sources(),
      this.find_tests(),
    ]).eslint()
  },

  async checks() {
    await Promise.all([
      this.coverage(),
      this.eslint(),
    ])
  },

  /* ======================================================================== *
   * TRANSPILE TYPES AND SOURCES IN "./dist" (dts, esm and cjs)               *
   * ======================================================================== */

  transpile_cjs(): Pipe {
    return this.find_sources().esbuild({
      outdir: 'dist',
      format: 'cjs',
      outExtension: { '.js': '.cjs' },
      sourcemap: 'linked',
      sourcesContent: false,
      plugins: [ fixExtensions() ],
      define: {
        __fileurl: '__filename',
      },
    })
  },

  transpile_mjs(): Pipe {
    return this.find_sources().esbuild({
      outdir: 'dist',
      format: 'esm',
      outExtension: { '.js': '.mjs' },
      sourcemap: 'linked',
      sourcesContent: false,
      plugins: [ fixExtensions() ],
      define: {
        __fileurl: 'import.meta.url',
      },
    })
  },

  copy_resources: () => {
    return merge([
      find('**/*.d.ts', { directory: 'src' }).copy('dist'),
      find('!**/*.ts', { directory: 'src' }).copy('dist'),
    ])
  },

  transpile_types(): Pipe {
    const extra = find('**/*.d.ts', { directory: 'extra' })
    const sources = this.find_sources()

    return merge([ extra, sources ]).tsc('tsconfig.json', {
      rootDir: 'src', // root this in "src" (filters out "extra/...")
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      outDir: './dist',
    })
  },

  async transpile(): Promise<Pipe> {
    await rmrf('dist')

    return merge([
      await this.copy_resources(),
      await this.transpile_cjs(),
      await this.transpile_mjs(),
      await this.transpile_types(),
    ])
  },

  /* ======================================================================== *
   * DEFAULT TASK                                                             *
   * ======================================================================== */

  async default() {
    await this.transpile()
    try {
      await this.test()
    } finally {
      await this.checks()
    }
  },
})
