import {
  build,
  exec,
  find,
  fixExtensions,
  log,
  merge,
  resolve,
  rmrf,
  type ESBuildOptions,
  type Pipe,
} from '@plugjs/plug'

/** Shared ESBuild options */
const esbuildOptions: ESBuildOptions = {
  platform: 'node',
  target: 'node16',
  sourcemap: 'linked',
  sourcesContent: false,
  plugins: [ fixExtensions() ],
}

export default build({
  find_sources: () => find('**/*.([cm])?ts', { directory: 'src', ignore: '**/*.d.ts' }),

  /* ======================================================================== *
   * TRANSPILATION                                                            *
   * ======================================================================== */

  /** Transpile to CJS */
  transpile_cjs(): Pipe {
    return this.find_sources().esbuild({
      ...esbuildOptions,
      format: 'cjs',
      outdir: 'dist',
      outExtension: { '.js': '.cjs' },
      define: {
        __fileurl: '__filename',
      },
    })
  },

  /** Transpile to ESM */
  transpile_esm(): Pipe {
    return this.find_sources().esbuild({
      ...esbuildOptions,
      format: 'esm',
      outdir: 'dist',
      outExtension: { '.js': '.mjs' },
      define: {
        __fileurl: 'import.meta.url',
      },
    })
  },

  /** Generate all .d.ts files */
  transpile_types(): Pipe {
    return this.find_sources().tsc('tsconfig.json', {
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      outDir: 'dist',
      extraTypesDir: 'types',
    })
  },

  /** Transpile all source code */
  async transpile() {
    await rmrf('dist')

    await Promise.all([
      this.transpile_cjs(),
      this.transpile_esm(),
      this.transpile_types(),
    ])
  },

  /* ======================================================================== *
   * TESTING                                                                  *
   * ======================================================================== */

  async test_esm() {
    log('Running test build in ESM mode')
    await exec('plug', '--force-esm', '-f', resolve('test/build.ts'), 'test', {
      coverageDir: '.coverage-data',
    })
  },

  async test_cjs() {
    log('Running test build in CJS mode')
    await exec('plug', '--force-cjs', '-f', resolve('test/build.ts'), 'test', {
      coverageDir: '.coverage-data',
    })
  },

  async test() {
    await rmrf('.coverage-data')

    await this.test_esm()
    await this.test_cjs()

    await this.find_sources().coverage('.coverage-data', {
      reportDir: 'coverage',
      minimumCoverage: 100,
      minimumFileCoverage: 100,
    })
  },

  /* ======================================================================== *
   * LINTING                                                                  *
   * ======================================================================== */

  async lint() {
    await merge([
      find('**/*.([cm])?ts', '**/*.([cm])?js', { directory: 'src' }),
      find('**/*.([cm])?ts', '**/*.([cm])?js', { directory: 'test' }),
      find('**/*.([cm])?ts', '**/*.([cm])?js', { directory: 'types' }),
    ]).eslint()
  },

  /* ======================================================================== *
   * DEFAULT                                                                  *
   * ======================================================================== */

  async default() {
    await Promise.all([
      this.transpile(),
      this.lint(),
      this.test(),
    ])
  },
})
