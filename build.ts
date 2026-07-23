import _fs from 'node:fs'
import { basename } from 'node:path'

import { plugjs } from './workspaces/plug/src/build'
import { ForkingPlug } from './workspaces/plug/src/fork'
import { find, invokeBuild, merge, resolve, rmrf, using } from './workspaces/plug/src/helpers'
import { $p, banner, log, logOptions } from './workspaces/plug/src/logging'
import { requireResolve } from './workspaces/plug/src/paths'
import { fixExtensions } from './workspaces/plug/src/plugs/esbuild'
// side-effect, install all build-in plugs
import './workspaces/plug/src/plugs'

import type { ESLint } from './workspaces/eslint/src/eslint'
import type { Test } from './workspaces/expect5/src/test'
import type { Files } from './workspaces/plug/src/files'
import type { AbsolutePath } from './workspaces/plug/src/paths'
import type { Context, PlugResult } from './workspaces/plug/src/pipe'
import type { Tsd } from './workspaces/tsd/src/tsd'
import type { TscCompiler } from './workspaces/typescript/src/tsccompiler'

logOptions.githubAnnotations = false
logOptions.taskLength = 16

/* ========================================================================== *
 * SHARED CONSTANTS (DEFAULTS) AND FUNCTIONS                                  *
 * ========================================================================== */

/** Coverage Data Directory */
const coverageDir = resolve('.coverage-data')

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

const ForkingESLint = class extends ForkingPlug {
  constructor(...args: ConstructorParameters<typeof ESLint>) {
    const scriptFile = requireResolve(import.meta.filename, './workspaces/eslint/src/eslint')
    super(scriptFile, args, 'ESLint')
  }
}

const ForkingTest = class extends ForkingPlug {
  constructor(private taskName: string, ...args: ConstructorParameters<typeof Test>) {
    const scriptFile = requireResolve(import.meta.filename, './workspaces/expect5/src/test')
    super(scriptFile, args, 'Test')
  }

  pipe(files: Files, context: Context): Promise<PlugResult> {
    return super.pipe(files, context.withTaskName(this.taskName))
  }
}

const ForkingTscCompiler = class extends ForkingPlug {
  constructor(...args: ConstructorParameters<typeof TscCompiler>) {
    const scriptFile = requireResolve(import.meta.filename, './workspaces/typescript/src/tsccompiler')
    super(scriptFile, args, 'TscCompiler')
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
      rmrf(coverageDir),
    ])
  },

  /* ======================================================================== *
   * TRANSPILATION                                                            *
   * ======================================================================== */

  /** Transpile all source code */
  async transpile(): Promise<void> {
    banner('Transpiling Sources')

    // first of all, clean up any previous build artifacts
    await Promise.all(workspaces.map((workspace) => rmrf(`${workspace}/dist`)))

    // function calling tsc, forking out the process (for parallelisation below)
    async function transpile(workspacePath: AbsolutePath): Promise<void> {
      await using(`${workspacePath}/tsconfig-build.json`)
          .plug(new ForkingTscCompiler())
    }

    // pre-transpile plugjs, as typescript itself needs it to run
    log.notice(`Pre-Transpiling ${$p(resolve(plugWorkspace, 'src'))}`)
    await find('**/*.ts', { directory: resolve(plugWorkspace, 'src') })
        .esbuild({
          platform: 'node', // transpile for NodeJS
          target: 'node22', // specifically NodeJS v22
          sourcemap: 'inline', // inline source maps for debugging
          sourcesContent: false, // don't include sources in source maps
          plugins: [ fixExtensions() ], // fix extensions (.ts -> .js)
          format: 'esm', // always use ESM
          outdir: resolve(plugWorkspace, 'dist'),
        })

    // now properly transpile plugjs (it's needed for all other workspaces)
    await transpile(plugWorkspace)

    // transpile all other workspaces in parallel
    if (this.workspace) {
      const workspacePath = validateWorkspace(this.workspace)
      if (workspacePath !== plugWorkspace) await transpile(workspacePath)
    } else {
      const promises = workspaces
          .filter((workspace) => workspace !== plugWorkspace)
          .map(transpile)
      await Promise.all(promises)
    }
  },

  /* ======================================================================== *
   * TESTING                                                                  *
   * ======================================================================== */

  /** Run TSD on our types tests */
  async tsd(): Promise<void> {
    banner('Cheking Types with TSD')

    await find('**/*.test-d.ts', { directory: 'test-d' })
        .plug(new ForkingTsd({
          cwd: 'test-d',
        }))
  },

  /** Run all tests */
  async test(): Promise<void> {
    banner('Running Tests')

    // selected workspaces
    const selection = this.workspace ? [ validateWorkspace(this.workspace) ] : workspaces

    // check types for tests in parallel
    await Promise.all(selection.map((workspace) => {
      return using(`${workspace}/test/tsconfig.json`)
          .plug(new ForkingTscCompiler())
    }))

    // run tests in ESM mode, one by one, with a proper task name
    for (const workspace of selection) {
      const name = basename(workspace)
      await find('test.ts', { directory: `${workspace}/test` })
          .plug(new ForkingTest(`test_${name}`, {
            coverageDir,
            summary: true,
          }))
    }
  },

  /* ======================================================================== *
   * COVERAGE                                                                 *
   * ======================================================================== */

  /** Generate coverage report */
  async coverage(): Promise<void> {
    banner('Test Coverage')

    const coverage = await import('./workspaces/cov8/src/coverage')
    const Coverage = coverage.Coverage

    const selection = this.workspace ? [ `workspaces/${this.workspace}` ] : workspaces

    const sources = merge(selection.map((workspace) => {
      return find('src/**/*.([cm])?ts', {
        directory: workspace,
        ignore: '**/cli.mts',
      })
    }))

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
          .debug()
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
