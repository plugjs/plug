import { $t, build, find, fixExtensions, log, merge, rmrf } from './src/index.js'

/** When `true` the coverage dir comes from the environment */
const environmentCoverage = !! process.env.NODE_V8_COVERAGE
/** The coverage data dir, might be supplied as an env variable  */
const coverageDir = process.env.NODE_V8_COVERAGE || '.coverage-data'

export default build({
  find_sources: () => find('**/*.ts', { directory: 'src' }),
  find_tests: () => find('**/*.ts', { directory: 'test' }),

  /* ======================================================================== *
   * RUN TESTS FROM "./test"                                                  *
   * ======================================================================== */

  async test() {
    if (environmentCoverage) {
      log.notice(`External coverage enabled, re-run task ${$t('coverage')} to generate full report`)
    } else {
      await rmrf(coverageDir)
    }

    await this.find_tests().mocha({ coverageDir })
  },

  /* ======================================================================== *
   * EXTRA CHECKS (dependencies, linting, coverage)                           *
   * ======================================================================== */

  async coverage() {
    await find('fooobarbaz').debug()

    try {
      await this.find_sources().coverage(coverageDir, {
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

  async transpile_cjs() {
    await this.find_sources().esbuild({
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

  async transpile_mjs() {
    await this.find_sources().esbuild({
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

  async copy_resources() {
    await find('!**/*.ts', { directory: 'src' })
        .copy('dist')
  },

  async transpile_types() {
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

  async transpile() {
    await rmrf('dist')

    await Promise.all([
      this.copy_resources(),
      this.transpile_cjs(),
      this.transpile_mjs(),
      this.transpile_types(),
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
