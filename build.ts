import { $t, build, fixExtensions, log, Pipe, rmrf } from './src/index.js'

/** When `true` the coverage dir comes from the environment */
const environmentCoverage = !! process.env.NODE_V8_COVERAGE
/** The coverage data dir, might be supplied as an env variable  */
const coverageDir = process.env.NODE_V8_COVERAGE || '.coverage-data'

export default build({
  find_sources(): Pipe {
    return this.find('**/*.ts', { directory: 'src' })
  },

  find_tests(): Pipe {
    return this.find('**/*.ts', { directory: 'test' })
  },

  /* ======================================================================== *
   * RUN TESTS FROM "./test"                                                  *
   * ======================================================================== */

  async test() {
    if (environmentCoverage) {
      log.notice(`External coverage enabled, re-run task ${$t('coverage')} to generate full report`)
    } else {
      await rmrf(coverageDir)
    }

    this.pipe('find_tests').mocha({ coverageDir })
  },

  /* ======================================================================== *
   * EXTRA CHECKS (dependencies, linting, coverage)                           *
   * ======================================================================== */

  async coverage() {
    try {
      await this.pipe('find_sources').coverage(coverageDir, {
        reportDir: 'coverage',
      }).run()
    } catch (error) {
      if (! environmentCoverage) throw error
    }
  },

  async eslint() {
    await this.merge('find_sources', 'find_tests').eslint()
  },

  async checks() {
    await this.parallel('coverage', 'eslint')
  },

  /* ======================================================================== *
   * TRANSPILE TYPES AND SOURCES IN "./dist" (dts, esm and cjs)               *
   * ======================================================================== */

  transpile_cjs(): Pipe {
    return this.pipe('find_sources').esbuild({
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
    return this.pipe('find_sources').esbuild({
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

  copy_resources(): Pipe {
    return this.find('!**/*.ts', { directory: 'src' })
        .copy('dist')
  },

  transpile_types(): Pipe {
    const extra = this.find('**/*.d.ts', { directory: 'extra' })
    const sources = this.pipe('find_sources')

    return this.merge(extra, sources).tsc('tsconfig.json', {
      rootDir: 'src', // root this in "src" (filters out "extra/...")
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      outDir: './dist',
    })
  },

  async transpile() {
    await rmrf('dist')

    await this.parallel(
        'copy_resources',
        'transpile_cjs',
        'transpile_mjs',
        'transpile_types',
    )
  },

  /* ======================================================================== *
   * DEFAULT TASK                                                             *
   * ======================================================================== */

  async default() {
    await this.run('transpile')
    try {
      await this.run('test')
    } finally {
      await this.run('checks')
    }
  },
})
