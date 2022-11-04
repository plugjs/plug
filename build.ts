// Import PlugJS plugins used by this build without using "install"
import { Coverage } from '@plugjs/cov8/coverage'
import { ESLint } from '@plugjs/eslint/eslint'
import { Mocha } from '@plugjs/mocha/mocha'
import { Tsc } from '@plugjs/typescript/typescript'

import { build, exec, find, fixExtensions, merge, rmrf, type Pipe } from './src/index.js'

export default build({
  find_sources: () => find('**/*.([cm])?ts', { directory: 'src', ignore: '**/*.d.ts' }),
  find_extras: () => find('**/*.([cm])?ts', { directory: 'extra', ignore: '**/*.d.ts' }),
  find_tests: () => find('**/*.([cm])?ts', { directory: 'test', ignore: '**/*.d.ts' }),

  /* ======================================================================== *
   * RUN TESTS FROM "./test"                                                  *
   * ======================================================================== */

  async test() {
    await this.find_tests()
        .plug(new Mocha({
          require: './test/.setup.ts',
        }))
  },

  /* ======================================================================== *
   * EXTRA CHECKS (dependencies, linting)                                     *
   * ======================================================================== */

  async check_extras() {
    await this.find_extras()
        .plug(new Tsc('tsconfig.json', {
          extraTypesDir: 'types',
          rootDir: '.',
        }))
  },

  async eslint() {
    await merge([
      this.find_sources(),
      this.find_extras(),
      this.find_tests(),
    ]).plug(new ESLint())
  },

  async checks() {
    await Promise.all([
      this.check_extras(),
      this.eslint(),
    ])
  },

  /* ======================================================================== *
   * TRANSPILE TYPES AND SOURCES IN "./dist" (dts, esm and cjs)               *
   * ======================================================================== */

  transpile_cjs(): Pipe {
    return this.find_sources()
        .esbuild({
          outdir: 'dist',
          format: 'cjs',
          outExtension: { '.js': '.cjs' },
          sourcemap: 'linked',
          sourcesContent: false,
          plugins: [ fixExtensions() ],
        })
  },

  transpile_mjs(): Pipe {
    return this.find_sources()
        .esbuild({
          outdir: 'dist',
          format: 'esm',
          outExtension: { '.js': '.mjs' },
          sourcemap: 'linked',
          sourcesContent: false,
          plugins: [ fixExtensions() ],
        })
  },

  transpile_types(): Pipe {
    return this.find_sources()
        .plug(new Tsc('tsconfig.json', {
          rootDir: 'src',
          noEmit: false,
          declaration: true,
          emitDeclarationOnly: true,
          outDir: './dist',
          extraTypesDir: 'types',
        }))
  },

  async transpile(): Promise<Pipe> {
    await rmrf('dist')

    return merge([
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
   * BUILD EVERYTHING                                                         *
   * ======================================================================== */

  async build() {
    await this.entrypoints()
    await this.transpile()
    try {
      await this.test()
    } finally {
      await this.checks()
    }
  },

  /* ======================================================================== *
   * SELF COVERAGE                                                            *
   * ======================================================================== */

  async coverage() {
    await this.find_sources()
        .plug(new Coverage('.coverage-data', { reportDir: 'coverage' }))
  },

  async default() {
    try {
      await exec('./extra/cli.mjs', 'build', {
        coverageDir: '.coverage-data',
        fork: true,
      })
    } finally {
      await this.coverage().catch(() => void 0)
    }
  },
})
