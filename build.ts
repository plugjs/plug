import { Coverage } from './workspaces/cov8/src/coverage.js'
import { $p, build, exec, find, fixExtensions, log, merge, resolve, rmrf } from './workspaces/plug/src/index'
import { Tsc } from './workspaces/typescript/src/typescript'

import type { ESBuildOptions, Files } from './workspaces/plug/src/index'


const workspaces = [
  'workspaces/plug',
  'workspaces/cov8',
  'workspaces/eslint',
  'workspaces/jasmine',
  'workspaces/typescript',
] as const

/** Shared ESBuild options */
const esbuildOptions: ESBuildOptions = {
  platform: 'node',
  target: 'node18',
  sourcemap: 'linked',
  sourcesContent: false,
  plugins: [ fixExtensions() ],
}

export default build({

  /* ======================================================================== *
   * TRANSPILATION                                                            *
   * ======================================================================== */

  /** Transpile to CJS */
  async transpile_cjs(): Promise<Files> {
    return merge(workspaces.map((workspace) => {
      log.notice(`Transpiling sources to CJS from ${$p(resolve(workspace))}`)
      return find('**/*.([cm])?ts', { directory: `${workspace}/src` })
          .esbuild({
            ...esbuildOptions,
            format: 'cjs',
            outdir: `${workspace}/dist`,
            outExtension: { '.js': '.cjs' },
          })
    }))
  },

  /** Transpile to ESM */
  async transpile_esm(): Promise<Files> {
    return merge(workspaces.map((workspace) => {
      log.notice(`Transpiling sources to ESM from ${$p(resolve(workspace))}`)
      return find('**/*.([cm])?ts', { directory: `${workspace}/src` })
          .esbuild({
            ...esbuildOptions,
            format: 'esm',
            outdir: `${workspace}/dist`,
            outExtension: { '.js': '.mjs' },
          })
    }))
  },

  /** Generate all Typescript definition files */
  async transpile_dts(): Promise<Files> {
    return merge(workspaces.map((workspace) => {
      log.notice(`Transpiling sources to DTS from ${$p(resolve(workspace))}`)
      return find('**/*.([cm])?ts', { directory: `${workspace}/src` })
          .plug(new Tsc(`${workspace}/tsconfig-base.json`, {
            noEmit: false,
            declaration: true,
            emitDeclarationOnly: true,
            outDir: `${workspace}/dist`,
          }))
    }))
  },

  /** Transpile all source code */
  async transpile(): Promise<void> {
    await merge([
      this.transpile_cjs(),
      this.transpile_esm(),
      this.transpile_dts(),
    ])
  },

  /* ======================================================================== *
   * TESTING                                                                  *
   * ======================================================================== */

  /** Run tests in CJS mode */
  async test_cjs(): Promise<void> {
    const files = await find('*/test/build.ts', { directory: 'workspaces' })

    const [ node, cli ] = process.argv

    for (const buildFile of files.absolutePaths()) {
      await exec(node!, ...process.execArgv, cli!, '--force-esm', '-f', buildFile, 'test', {
        coverageDir: '.coverage-data',
      })
    }
  },

  /** Run tests in ESM mode */
  async test_esm(): Promise<void> {
    const files = await find('*/test/build.ts', { directory: 'workspaces' })

    const [ node, cli ] = process.argv

    for (const buildFile of files.absolutePaths()) {
      await exec(node!, ...process.execArgv, cli!, '--force-cjs', '-f', buildFile, 'test', {
        coverageDir: '.coverage-data',
      })
    }
  },

  /** Gnerate coverage report */
  async test_cov(): Promise<void> {
    await find('*/src/**/*.([cm])?ts', { directory: 'workspaces' })
        .plug(new Coverage('.coverage-data', {
          reportDir: 'coverage',
          minimumCoverage: 100,
          minimumFileCoverage: 100,
        }))
  },

  /** Run tests and generate coverage */
  async test(): Promise<void> {
    await rmrf('.coverage-data')
    await this.test_cjs()
    await this.test_esm()
    await this.test_cov()
  },

  /* ======================================================================== *
   * DEFAULT                                                                  *
   * ======================================================================== */

  /* Run all tasks (sequentially) */
  async default(): Promise<void> {
    await this.transpile()
    await this.test()
  },
})
