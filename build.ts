import {
  $gry,
  $p,
  $wht,
  build,
  exec,
  fail,
  find,
  fixExtensions,
  fork,
  log,
  merge,
  paths,
  resolve,
  rmrf,
} from './workspaces/plug/src/index'

import type {
  AbsolutePath,
  ESBuildOptions,
  Files,
} from './workspaces/plug/src/index'

/** All known workspace paths */
const workspaces = [
  'workspaces/plug', // this _must_ be the first
  'workspaces/cov8',
  'workspaces/eslint',
  'workspaces/jasmine',
  'workspaces/mocha',
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

  /** Transpile CLI */
  async transpile_cli(): Promise<Files> {
    const tsc = await import('./workspaces/typescript/src/typescript.js')
    const Tsc = tsc.default.Tsc

    // then we *only check* the types for "workspaces/plug/extra"
    log.notice(`Checking extras types sanity in ${$p(resolve('workspaces/plug/extra'))}`)
    await find('**/*.([cm])?ts', { directory: 'workspaces/plug/extra' })
        .plug(new Tsc('workspaces/plug/tsconfig-base.json', {
          noEmit: true,
          declaration: false,
          emitDeclarationOnly: false,
          rootDir: 'workspaces/plug',
          extraTypesDir: 'workspaces/plug/types',
        }))

    log.notice(`Transpiling extras for CLI from ${$p(resolve('workspaces/plug/extra'))}`)
    return find('**/*.([cm])?ts', { directory: 'workspaces/plug/extra' })
        .esbuild({
          bundle: true,
          format: 'esm',
          target: 'node18',
          platform: 'node',
          sourcemap: 'inline',
          sourcesContent: false,
          external: [ 'esbuild' ],
          outExtension: { '.js': '.mjs' },
          outdir: 'workspaces/plug/extra',
        })
  },

  /** Generate all Typescript definition files */
  async transpile_dts(): Promise<void> {
    const ForkingTsc = class extends fork.ForkingPlug {
      constructor(...args: any[]) {
        const scriptFile = paths.requireResolve(__fileurl, './workspaces/typescript/src/typescript')
        super(scriptFile, args, 'Tsc')
      }
    }

    // call tsc, forking out the process (for parallelisation below)
    const transpile = async (workspace: string): Promise<void> => {
      log.notice(`Transpiling sources to DTS from ${$p(resolve(workspace))}`)
      await find('**/*.([cm])?ts', { directory: `${workspace}/src` })
          .plug(new ForkingTsc(`${workspace}/tsconfig-base.json`, {
            noEmit: false,
            declaration: true,
            emitDeclarationOnly: true,
            outDir: `${workspace}/dist`,
          }))
    }

    // all other workspaces need "plug"
    await transpile('workspaces/plug')

    // build the types only for our selected workspace or all plugins
    if (this.workspace) {
      if (this.workspace !== 'plug') {
        await transpile(`workspaces/${this.workspace}`)
      }
    } else {
      await Promise.all(workspaces.slice(1))
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
      'transpile_cli',
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
    log.notice(banner('Linting Sources'))

    const ForkingESLint = class extends fork.ForkingPlug {
      constructor(...args: any[]) {
        const scriptFile = paths.requireResolve(__fileurl, './workspaces/eslint/src/eslint')
        super(scriptFile, args, 'ESLint')
      }
    }

    await find('*/(src|extra|test|types)/**/*.([cm])?ts', { directory: 'workspaces' })
        .plug(new ForkingESLint())
  },

  /* ======================================================================== *
   * OTHER TASKS                                                              *
   * ======================================================================== */

  /* Cleanup generated files */
  async clean(): Promise<void> {
    await Promise.all( workspaces.map((workspace) => rmrf(`${workspace}/dist`)))
  },

  /* Only transpile and coverage (no linting) */
  async dev(): Promise<void> {
    await this.clean_coverage()
    await this.transpile()
    try {
      await this.test()
    } finally {
      await this.coverage()
    }
  },

  /* Run all tasks (sequentially) */
  async default(): Promise<void> {
    await this.clean_coverage()
    await this.transpile()
    await this.lint()
    try {
      await this.test()
    } finally {
      await this.coverage()
    }
  },
})
