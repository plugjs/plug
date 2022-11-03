// Reference types from PlugJS plugins used by this build
/// <reference types="@plugjs/mocha"/>

// Import PlugJS plugins used by this build without using "install"
import { Mocha } from '@plugjs/mocha/mocha'

import { build, find, fixExtensions, log, merge, rmrf, type Pipe } from './src/index.js'

/** When `true` the coverage dir comes from the environment */
const environmentCoverage = !! process.env.NODE_V8_COVERAGE

export default build({
  /** The coverage data dir, might be supplied as an env variable  */
  coverageDir: process.env.NODE_V8_COVERAGE || '.coverage-data',

  find_sources: () => find('**/*.([cm])?ts', { directory: 'src', ignore: '**/*.d.ts' }),
  find_extras: () => find('**/*.([cm])?ts', { directory: 'extra', ignore: '**/*.d.ts' }),
  find_tests: () => find('**/*.([cm])?ts', { directory: 'test', ignore: '**/*.d.ts' }),

  /* ======================================================================== *
   * RUN TESTS FROM "./test"                                                  *
   * ======================================================================== */

  async test() {
    if (environmentCoverage) {
      log.notice('External coverage enabled, re-run task "coverage" to generate full report')
    } else {
      await rmrf(this.coverageDir)
    }

    await this.find_tests().plug(new Mocha({
      coverageDir: this.coverageDir,
      require: './test/.setup.ts',
    }))
  },

  /* ======================================================================== *
   * EXTRA CHECKS (dependencies, linting, coverage)                           *
   * ======================================================================== */

  async check_extras() {
    await this.find_extras().debug().tsc('tsconfig.json', {
      extraTypesDir: 'types',
      rootDir: '.',
    })
  },

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
      this.find_extras(),
      this.find_tests(),
    ]).eslint()
  },

  async checks() {
    await Promise.all([
      this.check_extras(),
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
      find('!**/*.([cm])?ts', { directory: 'src' }).copy('dist'),
    ])
  },

  transpile_types(): Pipe {
    return this.find_sources().tsc('tsconfig.json', {
      rootDir: 'src',
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      outDir: './dist',
      extraTypesDir: 'types',
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
   * PACKAGE JSON ENTRY POINTS                                                *
   * ======================================================================== */

  async entrypoints(): Promise<Pipe> {
    const exports = [ '', 'asserts', 'files', 'fork', 'fs', 'logging', 'paths', 'pipe', 'utils' ]
    const entrypoints = exports.reduce((entrypoints, name) => {
      const [ key, base ] = name ? [ `./${name}`, `${name}` ] : [ '.', 'index' ]
      entrypoints[key] = {
        require: {
          types: `./dist/${base}.d.ts`,
          default: `./dist/${base}.cjs`,
        },
        import: {
          types: `./dist/${base}.d.ts`,
          default: `./dist/${base}.mjs`,
        },
      }

      return entrypoints
    }, {} as Record<string, any>)

    return find('./package.json')
        .edit((content) => {
          const data = JSON.parse(content)
          data.exports = entrypoints
          return JSON.stringify(data, null, 2).trim() + '\n'
        })
  },


  /* ======================================================================== *
   * DEFAULT TASK                                                             *
   * ======================================================================== */

  async default() {
    await this.entrypoints()
    await this.transpile()
    try {
      await this.test()
    } finally {
      await this.checks()
    }
  },
})
