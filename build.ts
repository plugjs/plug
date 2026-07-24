import _fs from 'node:fs'

import { ForkingPlug } from './workspaces/plug/src/fork.ts'
import { find, invokeBuild, merge, resolve, rmrf, using } from './workspaces/plug/src/helpers.ts'
import { plugjs } from './workspaces/plug/src/index.ts'
import { $p, banner, log, logOptions } from './workspaces/plug/src/logging.ts'
import { requireResolve } from './workspaces/plug/src/paths.ts'
import { fixExtensions } from './workspaces/plug/src/plugs/esbuild.ts'

import type { Coverage } from './workspaces/cov8/src/coverage.ts'
import type { ESLint } from './workspaces/eslint/src/eslint.ts'
import type { Test } from './workspaces/expect5/src/test.ts'
import type { AbsolutePath } from './workspaces/plug/src/index.ts'
import type { Tsd } from './workspaces/tsd/src/tsd.ts'
import type { TscBuild } from './workspaces/typescript/src/tscbuild.ts'

/* ========================================================================== *
 * SHARED CONSTANTS (DEFAULTS) AND FUNCTIONS                                  *
 * ========================================================================== */

/** Never emit GitHub annotations for this build */
logOptions.githubAnnotations = false

/** Coverage Data Directory */
const coverageDir = resolve('.coverage-data')

/** Typescript Build-Info Driectory */
const tsBuildInfoDir = resolve('.tsbuildinfo')

/** The "plug" workspace */
const plugWorkspace = resolve('workspaces/plug')

/** All known workspace paths */
const workspaces: AbsolutePath[] = (() => {
  const packageJsonPath = resolve('package.json')
  const packageJson = JSON.parse(_fs.readFileSync(packageJsonPath, 'utf-8'))
  const paths: string[] = packageJson.workspaces ?? []
  const workspaces = paths
      .map((name) => resolve(name))
      .filter((path) => path != plugWorkspace)
      .sort()
  return [ plugWorkspace, ...workspaces ]
})()

/** Validate a workspace (by path or name) */
function validateWorkspace(workspace: string): AbsolutePath {
  const workspacePath = resolve(workspace)
  if (workspaces.includes(workspacePath)) return workspacePath

  const workspaceSubPath = resolve('workspaces', workspace)
  if (workspaces.includes(workspaceSubPath)) return workspaceSubPath

  throw new Error(`Invalid workspace: "${workspace}"`)
}

/** Exports for our "package.json" files */
const workspaceExports: Record<string, [ string, ...string[] ]> = {
  'plug': [
    'index.*',
    'asserts.*',
    'files.*',
    'fork.*',
    'fs.*',
    'globals.*',
    'logging.*',
    'paths.*',
    'pipe.*',
    'utils.*',
  ],
  'cov8': [ 'index.*', 'coverage.*' ],
  'eslint': [ 'index.*', 'eslint.*' ],
  'expect5': [ 'index.*', 'globals.*', 'test.*' ],
  'tsd': [ 'index.*', 'tsd.*' ],
  'typescript': [ 'index.*', 'typescript.*' ],
  'zip': [ 'index.*', 'zip.*' ],
} as const

/* ========================================================================== *
 * PLUGS DEFINITIONS                                                          *
 * -------------------------------------------------------------------------- *
 * We define `tsc`, `eslint` ... and all other plugs we need here as we don't *
 * want to import them _before_ `transpile` has had a chance to compile the   *
 * sources they need to run (iow, they all need `plug`)... By keeping them    *
 * forking, their source files will only be read and executed once the plug   *
 * is instantiated!                                                           *
 * ========================================================================== */

const ForkingCoverage = class extends ForkingPlug {
  constructor(...args: ConstructorParameters<typeof Coverage>) {
    const scriptFile = requireResolve(import.meta.filename, './workspaces/cov8/src/coverage')
    super(scriptFile, args, 'Coverage')
  }
}

const ForkingESLint = class extends ForkingPlug {
  constructor(...args: ConstructorParameters<typeof ESLint>) {
    const scriptFile = requireResolve(import.meta.filename, './workspaces/eslint/src/eslint')
    super(scriptFile, args, 'ESLint')
  }
}

const ForkingTest = class extends ForkingPlug {
  constructor(...args: ConstructorParameters<typeof Test>) {
    const scriptFile = requireResolve(import.meta.filename, './workspaces/expect5/src/test')
    super(scriptFile, args, 'Test')
  }
}

const ForkingTscBuild = class extends ForkingPlug {
  constructor(...args: ConstructorParameters<typeof TscBuild>) {
    const scriptFile = requireResolve(import.meta.filename, './workspaces/typescript/src/tscbuild')
    super(scriptFile, args, 'TscBuild')
  }
}

const ForkingTsd = class extends ForkingPlug {
  constructor(...args: ConstructorParameters<typeof Tsd>) {
    const scriptFile = requireResolve(import.meta.filename, './workspaces/tsd/src/tsd')
    super(scriptFile, args, 'Tsd')
  }
}

/* ========================================================================== *
 * ========================================================================== *
 * BUILD DEFINITION                                                           *
 * ========================================================================== *
 * ========================================================================== */

export default plugjs({
  workspace: '',

  /* ======================================================================== *
   * CLEANUP                                                                  *
   * ======================================================================== */

  async clean(): Promise<void> {
    banner('Cleaning Build Artifacts')

    await Promise.all([
      ...workspaces.map((workspace) => rmrf(`${workspace}/dist`)),
      rmrf(tsBuildInfoDir),
      rmrf(coverageDir),
    ])
  },

  /* ======================================================================== *
   * TRANSPILATION                                                            *
   * ======================================================================== */

  /** Transpile all source code */
  async transpile(): Promise<void> {
    // cleanup everything first...
    await this.clean()

    // our nice banner...
    banner('Transpiling Sources')

    // pre-transpile plugjs, as typescript itself needs it to run
    await find('**/*.ts', { directory: resolve(plugWorkspace, 'src') })
        .esbuild({
          platform: 'node', // transpile for NodeJS
          target: `node${process.versions['node']}`, // target _this_ version
          sourcemap: 'inline', // inline source maps for debugging
          sourcesContent: false, // don't include sources in source maps
          plugins: [ fixExtensions() ], // fix extensions (.ts -> .js)
          format: 'esm', // always use ESM
          outdir: resolve(plugWorkspace, 'dist'),
        })

    // we _always_ transpile all workspaces (regardless of the `workspace`
    // option) because testing here depends on "expect5", and "expect5" depends
    // on "plug" (a circular dependency when only testing "plug" itself), anyhow
    // with TypeScript 7 this will basically be immediate!
    log.notice('Transpiling all workspaces')
    await using('tsconfig.workspaces.json').plug(new ForkingTscBuild())
  },

  /* ======================================================================== *
   * TESTING AND COVERAGE                                                     *
   * ======================================================================== */

  /** Run TSD on our types tests */
  async tsd(): Promise<void> {
    banner('Checking Types with TSD')

    await find('**/*.test-d.ts', { directory: 'test-d' })
        .plug(new ForkingTsd({
          cwd: 'test-d',
        }))
  },

  /** Run tests */
  async test(): Promise<void> {
    await this.transpile()

    banner('Testing')

    // selected workspaces (and related "tsconfig.json" files)")
    const selection = this.workspace ? [ validateWorkspace(this.workspace) ] : workspaces
    const configs = selection.map((workspace) => resolve(workspace, 'test', 'tsconfig.json'))

    // check types for the selected workspaces
    log.notice('Checking test types in', configs.length, 'workspaces')
    await using(...configs).plug(new ForkingTscBuild({ force: false }))

    // run tests in ESM mode, one by one, with a proper task name
    for (const workspace of selection) {
      banner(`Testing Workspace ${$p(workspace)}`)

      await find('test.ts', { directory: `${workspace}/test` })
          .plug(new ForkingTest({
            coverageDir,
            summary: true,
          }))
    }
  },

  /** Generate coverage report */
  async coverage(): Promise<void> {
    banner('Test Coverage')

    const selection = this.workspace ? [ `workspaces/${this.workspace}` ] : workspaces

    const sources = merge(selection.map((workspace) => {
      return find('src/**/*.([cm])?ts', {
        directory: workspace,
        ignore: '**/cli.mts',
      })
    }))

    await sources.plug(new ForkingCoverage(coverageDir, {
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

    const sources = this.workspace ?
      find('src/**/*.([cm])?ts', { directory: `workspaces/${this.workspace}` }) :
      find('*/src/**/*.([cm])?ts', { directory: 'workspaces' })
    const tests = this.workspace ?
      find('test/*.ts', 'test/**/*.test.ts', { directory: `workspaces/${this.workspace}` }) :
      find('*/test/*.ts', '*/test/**/*.test.ts', { directory: 'workspaces' })

    const lintables = [ sources, tests, using('build.ts', 'eslint.config.js') ]
    if (! this.workspace) lintables.push(find('**/*.ts', { directory: 'test-d' }))

    await merge(lintables).plug(new ForkingESLint())
  },

  /* ======================================================================== *
   * OTHER TASKS                                                              *
   * ======================================================================== */

  /* Prepare exports in our "package.json" files */
  async exports(): Promise<void> {
    // We need to have the transpiled sources...
    await this.transpile()

    banner('Updating exports')

    for (const [ name, globs ] of Object.entries(workspaceExports)) {
      log.notice(`Updating exports for workspace "${name}"`)
      const workspace = validateWorkspace(name)
      await find(...globs, { directory: `${workspace}/dist` })
          .exports({ packageJson: `${workspace}/package.json` })
    }
  },

  /* Only transpile and coverage (no linting) */
  async dev(): Promise<void> {
    let error: any = undefined

    await rmrf(coverageDir)
    await this.transpile()
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
    await this.clean()
    await this.transpile()
    await this.test()
    await this.tsd()
    await this.lint()
  },

  /* Run all tasks (sequentially) */
  async default(): Promise<void> {
    log.notice('Forking to collect self coverage')

    await invokeBuild('./build.ts', 'build', {
      workspace: this.workspace,
      coverageDir,
    })

    await this.coverage()
  },
})
