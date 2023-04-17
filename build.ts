import {
  $gry,
  $p,
  banner,
  build,
  find,
  fixExtensions,
  fork,
  invokeBuild,
  log,
  logging,
  merge,
  parseJson,
  paths,
  resolve,
  rmrf,
} from './workspaces/plug/src/index'

import type { ESLint } from './workspaces/eslint/src/eslint'
import type { Test } from './workspaces/expect5/src/test'
import type { ESBuildOptions, Files } from './workspaces/plug/src/index'
import type { Tsc } from './workspaces/typescript/src/typescript'

logging.logOptions.githubAnnotations = false

/* ========================================================================== *
 * OUR WORKSPACES                                                             *
 * ========================================================================== */

/** All known workspace paths */
const workspaces = [
  'workspaces/plug', // this _must_ be the first
  'workspaces/cov8',
  'workspaces/eslint',
  'workspaces/expect5',
  'workspaces/tsd',
  'workspaces/typescript',
  'workspaces/zip',
] as const

/** Exports for our "package.json" files */
const workspaceExports: Record<typeof workspaces[number], [ string, ...string[] ]> = {
  'workspaces/plug': [
    'index.*',
    'asserts.*',
    'files.*',
    'fork.*',
    'fs.*',
    'logging.*',
    'paths.*',
    'pipe.*',
    'utils.*',
  ],
  'workspaces/cov8': [ 'index.*', 'coverage.*' ],
  'workspaces/eslint': [ 'index.*', 'eslint.*' ],
  'workspaces/expect5': [ 'index.*', 'globals.*', 'test.*' ],
  'workspaces/tsd': [ 'index.*', 'tsd.*' ],
  'workspaces/typescript': [ 'index.*', 'typescript.*' ],
  'workspaces/zip': [ 'index.*', 'zip.*' ],
}

/* ========================================================================== *
 * SHARED CONSTANTS (DEFAULTS) AND FUNCTIONS                                  *
 * ========================================================================== */

/** Coverage Data Directory */
const coverageDir = '.coverage-data'

/** Shared ESBuild options */
const esbuildOptions: ESBuildOptions = {
  platform: 'node',
  target: 'node18',
  sourcemap: 'linked',
  sourcesContent: false,
  plugins: [ fixExtensions() ],
}

/* ========================================================================== *
 * PLUGS DEFINITIONS                                                          *
 * -------------------------------------------------------------------------- *
 * We define `tsc` and `eslint` here as we don't want to import them _before_ *
 * `transpile` has had a chance to compile the sources they need to run (iow, *
 * they all need `plug`)... By keeping them forking, their source files will  *
 * only be read and executed once the plug is instantiated!                   *
 * ========================================================================== */

const ForkingESLint = class extends fork.ForkingPlug {
  constructor(...args: ConstructorParameters<typeof ESLint>) {
    const scriptFile = paths.requireResolve(__fileurl, './workspaces/eslint/src/eslint')
    super(scriptFile, args, 'ESLint')
  }
}

const ForkingTest = class extends fork.ForkingPlug {
  constructor(...args: ConstructorParameters<typeof Test>) {
    const scriptFile = paths.requireResolve(__fileurl, './workspaces/expect5/src/test')
    super(scriptFile, args, 'Test')
  }
}

const ForkingTsc = class extends fork.ForkingPlug {
  constructor(...args: ConstructorParameters<typeof Tsc>) {
    const scriptFile = paths.requireResolve(__fileurl, './workspaces/typescript/src/typescript')
    super(scriptFile, args, 'Tsc')
  }
}

/* ========================================================================== *
 * ========================================================================== *
 * BUILD DEFINITION                                                           *
 * ========================================================================== *
 * ========================================================================== */

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
    const version = parseJson('package.json').version

    // then we *only check* the types for "workspaces/plug/extra"
    log.notice(`Checking extras types sanity in ${$p(resolve('workspaces/plug/extra'))}`)
    await find('**/*.([cm])?ts', { directory: 'workspaces/plug/extra' })
        .plug(new ForkingTsc('workspaces/plug/tsconfig-base.json', {
          noEmit: true,
          declaration: false,
          emitDeclarationOnly: false,
          rootDir: 'workspaces/plug',
          extraTypesDir: 'workspaces/plug/types',
        }))

    log.notice(`Transpiling extras for CLI from ${$p(resolve('workspaces/plug/extra'))}`)
    return find('**/*.mts', { directory: 'workspaces/plug/extra' })
        .esbuild({
          bundle: true,
          format: 'esm',
          target: 'node18',
          platform: 'node',
          sourcemap: 'inline',
          sourcesContent: false,
          external: [ 'esbuild' ],
          outExtension: { '.js': '.mjs' },
          define: { '__version': JSON.stringify(version) },
          outdir: 'workspaces/plug/cli',
        })
  },

  /** Generate all Typescript definition files */
  async transpile_dts(): Promise<void> {
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
      await Promise.all(workspaces.slice(1).map(transpile))
    }
  },

  /** Transpile all source code */
  async transpile(): Promise<void> {
    banner('Transpiling')

    await this.transpile_cjs()
    await this.transpile_esm()
    await this.transpile_cli()
    await this.transpile_dts()
  },

  /* ======================================================================== *
   * TESTING                                                                  *
   * ======================================================================== */

  /** Check types of tests */
  async check(): Promise<void> {
    banner('Cheking TypeScript for Tests')
    const selection = this.workspace ? [ `workspaces/${this.workspace}` ] : workspaces

    await Promise.all(selection.map((workspace) => {
      log.notice(`Checking test types in ${$p(resolve(workspace))}`)
      return find('**/*.test.([cm])?ts', { directory: `${workspace}/test` })
          .plug(new ForkingTsc(`${workspace}/test/tsconfig.json`, {
            rootDir: '.',
            noEmit: true,
            declaration: false,
            emitDeclarationOnly: false,
          }))
    }))
  },

  /** Run tests in CJS mode */
  async test_cjs(): Promise<void> {
    banner('Running Tests (CommonJS)')

    const selection = this.workspace ? [ `workspaces/${this.workspace}` ] : workspaces

    await merge(selection.map((workspace) => {
      return find('**/*.test.ts', { directory: `${workspace}/test` })
    })).plug(new ForkingTest({
      forceModule: 'commonjs',
      coverageDir,
    }))
  },

  /** Run tests in ESM mode */
  async test_esm(): Promise<void> {
    banner('Running Tests (ES Modules)')

    const selection = this.workspace ? [ `workspaces/${this.workspace}` ] : workspaces

    await merge(selection.map((workspace) => {
      return find('**/*.test.ts', { directory: `${workspace}/test` })
    })).plug(new ForkingTest({
      forceModule: 'module',
      coverageDir,
    }))
  },

  /** Run all tests */
  async test(): Promise<void> {
    await this.check()
    await this.test_cjs()
    await this.test_esm()
  },

  /* ======================================================================== *
   * COVERAGE                                                                 *
   * ======================================================================== */

  async clean_coverage(): Promise<void> {
    await rmrf(coverageDir)
  },

  /** Gnerate coverage report */
  async coverage(): Promise<void> {
    banner('Test Coverage')

    const coverage = await import('./workspaces/cov8/src/coverage')
    const Coverage = coverage.Coverage

    const selection = this.workspace ? [ `workspaces/${this.workspace}` ] : workspaces

    const sources = merge(selection.map((workspace) => {
      return find('src/**/*.([cm])?ts', { directory: workspace })
    })).filter('**/*.*', { directory: '.' })

    // @ts-ignore
    await sources.plug(new Coverage(coverageDir, {
      reportDir: 'coverage',
      optimalCoverage: 100,
      minimumCoverage: 80,
      optimalFileCoverage: 100,
      minimumFileCoverage: 0,
    }))
  },

  /* ======================================================================== *
   * LINTING                                                                  *
   * ======================================================================== */

  async lint(): Promise<void> {
    banner('Linting Sources')

    const pipe = this.workspace ?
      find('(src|extra|test|types)/**/*.([cm])?ts', { directory: `workspaces/${this.workspace}` }) :
      find('*/(src|extra|test|types)/**/*.([cm])?ts', { directory: 'workspaces' })

    await pipe.plug(new ForkingESLint())
  },

  /* ======================================================================== *
   * OTHER TASKS                                                              *
   * ======================================================================== */

  /* Prepare exports in our "package.json" files */
  async exports(): Promise<void> {
    const version = parseJson('package.json').version

    banner(`Updating package.json files (version=${version})`)

    for (const workspace of workspaces) {
      const globs = workspaceExports[workspace]
      await find(...globs, { directory: `${workspace}/dist` })
          .exports({
            packageJson: `${workspace}/package.json`,
            cjsExtension: '.cjs',
            esmExtension: '.mjs',
          })
          .edit((contents, filename) => {
            const packageData = JSON.parse(contents)
            log.notice($gry('* Updating'), packageData.name, $gry('in'), $p(filename))
            packageData.version = version
            if (workspace !== 'workspaces/plug') {
              packageData.peerDependencies['@plugjs/plug'] = version
            }
            return JSON.stringify(packageData, null, 2) + '\n'
          })
    }
  },

  /* Cleanup generated files */
  async clean(): Promise<void> {
    await rmrf(coverageDir)
    await rmrf('workspaces/plug/cli')
    await Promise.all( workspaces.map((workspace) => rmrf(`${workspace}/dist`)))
  },

  /* Only transpile and coverage (no linting) */
  async dev(): Promise<void> {
    let error: any = undefined

    await this.clean_coverage()
    await this.transpile()
    await this.check() // dev mode, run checks _before_ tests
    try {
      await this.test()
    } catch (err) {
      error = err
    } finally {
      await this.coverage().catch((err) => {
        throw error || err
      })
    }
  },

  /* Build everything (forked from "default" to collect coverage) */
  async build(): Promise<void> {
    await this.clean_coverage()
    await this.transpile()
    await this.test()
    await this.lint()
  },

  /* Run all tasks (sequentially) */
  async default(): Promise<void> {
    let error: any = undefined
    try {
      log.notice('Forking to collect self coverage')
      await invokeBuild('./build.ts', 'build', {
        workspace: this.workspace,
        coverageDir,
      })
    } catch (err) {
      error = err
    } finally {
      await this.coverage().then(() => {
        if (error) throw error
      }, (err) => {
        throw error || err
      })
    }
  },
})
