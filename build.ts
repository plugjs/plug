import { $p, build, exec, find, fixExtensions, log, merge, resolve, rmrf } from './workspaces/plug/src/index'

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
  workspace: '*',

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
  async transpile_dts(): Promise<void> {
    const tsc = await import('./workspaces/typescript/src/typescript.js')
    const Tsc = tsc.default.Tsc

    // can not parallelize this: we need the plug.js types **first**
    for (const workspace of workspaces) {
      log.notice(`Transpiling sources to DTS from ${$p(resolve(workspace))}`)
      await find('**/*.([cm])?ts', { directory: `${workspace}/src` })
          .plug(new Tsc(`${workspace}/tsconfig-base.json`, {
            noEmit: false,
            declaration: true,
            emitDeclarationOnly: true,
            outDir: `${workspace}/dist`,
          }))
    }
  },

  /** Transpile all source code */
  async transpile(): Promise<void> {
    await this.transpile_cjs()
    await this.transpile_esm()
    await this.transpile_dts()
  },

  /* ======================================================================== *
   * TESTING                                                                  *
   * ======================================================================== */

  /** Find tests to run */
  find_test(): Promise<Files> {
    return find(`${this.workspace}/test/build.ts`, {
      directory: 'workspaces',
    }).debug()
  },

  find_coverage(): Promise<Files> {
    return find(`${this.workspace}/src/**/*.([cm])?ts`, {
      directory: 'workspaces',
    }).debug()
  },

  /** Run tests in CJS mode */
  async test_cjs(): Promise<void> {
    const files = await this.find_test()

    const [ node, cli ] = process.argv

    for (const buildFile of files.absolutePaths()) {
      await exec(node!, ...process.execArgv, cli!, '--force-esm', '-f', buildFile, 'test', {
        coverageDir: '.coverage-data',
      })
    }
  },

  /** Run tests in ESM mode */
  async test_esm(): Promise<void> {
    const files = await this.find_test()

    const [ node, cli ] = process.argv

    for (const buildFile of files.absolutePaths()) {
      await exec(node!, ...process.execArgv, cli!, '--force-cjs', '-f', buildFile, 'test', {
        coverageDir: '.coverage-data',
      })
    }
  },

  /** Gnerate coverage report */
  async coverage(): Promise<void> {
    const coverage = await import('./workspaces/cov8/src/coverage.js')
    const Coverage = coverage.default.Coverage

    await this.find_coverage()
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
    // await this.test_esm()
    await this.coverage()
  },

  /* ======================================================================== *
   * DEFAULT                                                                  *
   * ======================================================================== */

  /* Cleanup generated files */
  async clean(): Promise<void> {
    await Promise.all( workspaces.map((workspace) => rmrf(`${workspace}/dist`)))
  },

  /* Run all tasks (sequentially) */
  async default(): Promise<void> {
    await this.transpile()
    await this.test()
  },
})
