import {
  $gry,
  $p,
  $wht,
  build,
  exec,
  fail,
  find,
  fixExtensions,
  log,
  merge,
  resolve,
  rmrf,
} from './workspaces/plug/src/index'

// import type { AbsolutePath } from '@plugjs/plug/paths'
import type {
  AbsolutePath,
  ESBuildOptions,
  Files,
} from './workspaces/plug/src/index'

/** All known workspace paths */
const workspaces = [
  'workspaces/plug',
  'workspaces/cov8',
  'workspaces/eslint',
  'workspaces/jasmine',
  'workspaces/mocha',
  'workspaces/typescript',
]

/** Shared ESBuild options */
const esbuildOptions: ESBuildOptions = {
  platform: 'node',
  target: 'node18',
  sourcemap: 'linked',
  sourcesContent: false,
  plugins: [ fixExtensions() ],
}

/** Niceties... */
function banner(message: string): string {
  return [
    '',
    $gry(`\u2554${''.padStart(60, '\u2550')}\u2557`),
    `${$gry('\u2551')} ${$wht(message.padEnd(58, ' '))} ${$gry('\u2551')}`,
    $gry(`\u255A${''.padStart(60, '\u2550')}\u255D`),
    '',
  ].join('\n')
}

export default build({
  workspace: '',

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
    await this.clean_coverage()

    log.notice(banner('Transpiling'))

    const [ node, cli ] = process.argv

    const subTasks = [
      'transpile_cjs',
      'transpile_esm',
      'transpile_dts',
    ]

    await exec(node!, ...process.execArgv, cli!, ...subTasks, {
      coverageDir: '.coverage-data',
    })
  },

  /* ======================================================================== *
   * TESTING                                                                  *
   * ======================================================================== */

  /** Run tests in CJS mode */
  async test(): Promise<void> {
    await this.clean_coverage()

    const [ node, cli ] = process.argv

    const selection = this.workspace ? [ `workspaces/${this.workspace}` ] : workspaces

    for (const mode of [ 'esm', 'cjs' ] as const) {
      const errors: AbsolutePath[] = []
      for (const workspace of selection) {
        const buildFile = resolve(workspace, 'test', 'build.ts')
        try {
          log.notice(banner(`${mode.toUpperCase()} Tests (${workspace})`))
          await exec(node!, ...process.execArgv, cli!, `--force-${mode}`, '-f', buildFile, 'test', {
            coverageDir: '.coverage-data',
          })
        } catch (error: any) {
          log.error(error)
          errors.push(buildFile)
        }
      }

      if (errors.length === 0) return

      log.error(banner('Tests failed'))
      log.error(`Found test errors in ${errors.length} subprojects`)
      errors.forEach((file) => log.error('*', $p(file)))
      log.error('')
      fail('')
    }
  },

  /* ======================================================================== *
   * COVERAGE                                                                 *
   * ======================================================================== */

  async clean_coverage(): Promise<void> {
    await rmrf('.coverage-data')
    await rmrf('.coverage-test-data')
  },

  find_coverage(): Promise<Files> {
    return find(`${this.workspace}/src/**/*.([cm])?ts`, {
      directory: 'workspaces',
    })
  },

  /** Gnerate coverage report */
  async coverage(): Promise<void> {
    log.notice(banner('Test Coverage'))

    const coverage = await import('./workspaces/cov8/src/coverage.js')
    const Coverage = coverage.default.Coverage

    const selection = this.workspace ? [ `workspaces/${this.workspace}` ] : workspaces

    const sources = merge(selection.map((workspace) => {
      return find('src/**/*.([cm])?ts', { directory: workspace })
    }))

    await sources.plug(new Coverage('.coverage-data', {
      reportDir: 'coverage',
      minimumCoverage: 100,
      minimumFileCoverage: 100,
    }))
  },

  /* ======================================================================== *
   * LINTING                                                                  *
   * ======================================================================== */

  async lint(): Promise<void> {
    const eslint = await import('./workspaces/eslint/src/eslint.js')
    const ESLint = eslint.default.ESLint

    await find('*/(src|test)/**/*.([cm])?ts', { directory: 'workspaces' })
        .plug(new ESLint())
  },

  /* ======================================================================== *
   * OTHER TASKS                                                              *
   * ======================================================================== */

  /* Cleanup generated files */
  async clean(): Promise<void> {
    await Promise.all( workspaces.map((workspace) => rmrf(`${workspace}/dist`)))
  },

  /* Run all tasks (sequentially) */
  async default(): Promise<void> {
    await this.clean_coverage()
    await this.transpile()
    try {
      await this.test()
    } finally {
      await this.coverage()
    }
  },
})
