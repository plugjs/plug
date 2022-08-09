import { build, checkDependencies, find, fixExtensions, parallel, rmrf } from './src/index'

export default build({
  find_sources: () => find('**/*.ts', { directory: 'src', ignore: 'cli.ts' }),
  find_tests: () => find('**/*.ts', { directory: 'test' }),

  /* ======================================================================== *
   * COMPILE AND RUN TESTS IN "./build"                                       *
   * ======================================================================== */

  async compile_tests() {
    await rmrf('build')

    await find('src/**', 'test/**', { ignore: '**/*.ts' })
        .copy('build')

    /* compile sources in "build/src", needed by tests */
    await this.find_sources().esbuild({
      outdir: 'build/src',
      format: 'cjs',
      sourcemap: 'inline',
      sourcesContent: false,
      plugins: [ fixExtensions() ],
    })

    /* compile tests in "build/test", return them */
    return this.find_tests().esbuild({
      outdir: 'build/test',
      format: 'cjs',
      sourcemap: 'inline',
      sourcesContent: false,
      plugins: [
        checkDependencies({ allowDev: true, allowUnused: true }),
        fixExtensions(),
      ],
    })
  },

  async test() {
    await rmrf('build/coverage')

    await this.compile_tests().mocha({
      coverageDir: 'build/coverage',
    })
  },

  /* ======================================================================== *
   * EXTRA CHECKS (dependencies, linting, coverage)                           *
   * ======================================================================== */

  async check_deps() {
    await parallel([
      await this.find_sources().esbuild({
        plugins: [ checkDependencies({ allowDev: false, allowUnused: false }) ],
        write: false,
      }),
      await this.find_tests().esbuild({
        plugins: [ checkDependencies({ allowDev: true, allowUnused: true }) ],
        write: false,
      }),
    ])
  },

  async check_coverage() {
    await this.test() // no coverage without tests, right?

    await rmrf('coverage')
    await this.find_sources().coverage('build/coverage', {
      reportDir: 'coverage',
    })
  },

  async check_format() {
    await this.find_sources().eslint()
    await this.find_tests().eslint()
  },

  async check() {
    await parallel([
      this.check_deps(),
      this.check_coverage(),
      this.check_format(),
    ])
  },

  /* ======================================================================== *
   * COMPILE TYPES IN "./types" AND SOURCES IN "./dist" (esm and cjs)         *
   * ======================================================================== */

  async compile_cli() {
    await find('cli.ts', { directory: 'src' }).esbuild({
      outdir: 'dist',
      format: 'cjs',
      sourcemap: 'external',
      sourcesContent: false,
      plugins: [ fixExtensions() ],
    })
  },

  async compile_cjs() {
    await this.find_sources().esbuild({
      outdir: 'dist',
      format: 'cjs',
      sourcemap: 'external',
      sourcesContent: false,
      plugins: [ fixExtensions() ],
    })
  },

  async compile_mjs() {
    await this.find_sources().esbuild({
      outdir: 'dist',
      format: 'esm',
      outExtension: { '.js': '.mjs' },
      sourcemap: 'external',
      sourcesContent: false,
      plugins: [ fixExtensions() ],
      define: { __filename: 'import.meta.url' },
    })
  },

  async copy_resources() {
    await find('!**/*.ts', { directory: 'src' })
        .copy('dist')
  },

  async compile_types() {
    await this.find_sources().tsc('tsconfig.json', {
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      outDir: './types',
    })
  },

  async compile() {
    await rmrf('dist')
    await rmrf('types')

    await parallel([
      this.copy_resources(),
      this.compile_cjs(),
      this.compile_mjs(),
      this.compile_cli(),
      this.compile_types(),
    ])
  },

  /* ======================================================================== *
   * DEFAULT TASK                                                             *
   * ======================================================================== */

  async default() {
    // await this.test()
    // await this.check()
    await this.compile()
  },
})
