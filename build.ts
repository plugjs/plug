import { build, checkDependencies, find, fixExtensions, parallel, rmrf } from './src/index'

export default build({
  find_sources: () => find('**/*.ts', { directory: 'src' }),
  find_tests: () => find('**/*.ts', { directory: 'test' }),

  /* ======================================================================== *
   * COMPILE AND RUN TESTS IN "./build"                                       *
   * ======================================================================== */

  async test() {
    await rmrf('coverage')

    await this.find_tests().mocha({
      coverageDir: 'coverage',
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
    // setLogLevel('debug')
    try {
      // await this.test() // no coverage without tests, right?
    } finally {
      await this.find_sources().coverage('coverage', {
        reportDir: 'coverage',
        // usePreciseMappings: true,
      })
    }
  },

  async check_format() {
    await this.find_sources().eslint()
    await this.find_tests().eslint()
  },

  async check() {
    // await parallel([
    // await this.check_deps()
    await this.check_coverage()
    await this.check_format()
    // ])
  },

  /* ======================================================================== *
   * COMPILE TYPES IN "./types" AND SOURCES IN "./dist" (esm and cjs)         *
   * ======================================================================== */

  // async compile_cli() {
  //   await find('cli.ts', { directory: 'src' }).esbuild({
  //     outdir: 'dist',
  //     format: 'cjs',
  //     sourcemap: 'external',
  //     sourcesContent: false,
  //     plugins: [ fixExtensions() ],
  //   })
  // },

  async compile_cjs() {
    await this.find_sources().esbuild({
      outdir: 'dist',
      format: 'cjs',
      outExtension: { '.js': '.cjs' },
      sourcemap: 'linked',
      sourcesContent: false,
      plugins: [ fixExtensions() ],
      define: {
        __tsLoaderCJS: 'globalThis.__tsLoaderCJS',
        __tsLoaderESM: 'globalThis.__tsLoaderESM',
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
        __tsLoaderCJS: 'globalThis.__tsLoaderCJS',
        __tsLoaderESM: 'globalThis.__tsLoaderESM',
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

    // different "find_sources" as we also want "./extra/globals.d.ts"
    return find('src/**/*.ts', 'extra/globals.d.ts')
        .tsc('tsconfig.json', {
          rootDir: 'src', // root this in "src" (to avoid "types/src")
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
      // this.compile_cli(),
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
      await this.check()
    }
  },
})
