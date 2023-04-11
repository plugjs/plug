import { tasks, build, banner, isDirectory, rmrf, fork, paths } from '@plugjs/build'

import type { Test } from './src/test'

const ForkingTest = class extends fork.ForkingPlug {
  constructor(...args: ConstructorParameters<typeof Test>) {
    const scriptFile = paths.requireResolve(__fileurl, './src/test')
    super(scriptFile, args, 'Test')
  }
}


export default build({
  ...tasks({
    exportsGlob: '(index|globals).*',
  }),

  /** Run tests */
  async test_cjs(): Promise<void> {
    banner('Running tests (CommonJS)')

    const forceType = process.env.__TS_LOADER_FORCE_TYPE
    try {
      process.env.__TS_LOADER_FORCE_TYPE = 'commonjs'
      await this
          ._find_tests()
          .plug(new ForkingTest({ coverageDir: this.coverageDataDir }))
    } finally {
      delete process.env.__TS_LOADER_FORCE_TYPE
      if (forceType) process.env.__TS_LOADER_FORCE_TYPE = forceType
    }
  },

  /** Run tests */
  async test_esm(): Promise<void> {
    banner('Running tests (ES Modules)')

    const forceType = process.env.__TS_LOADER_FORCE_TYPE
    try {
      process.env.__TS_LOADER_FORCE_TYPE = 'module'
      await this
          ._find_tests()
          .plug(new ForkingTest({ coverageDir: this.coverageDataDir }))
    } finally {
      delete process.env.__TS_LOADER_FORCE_TYPE
      if (forceType) process.env.__TS_LOADER_FORCE_TYPE = forceType
    }
  },

  /** Run tests */
  async test(): Promise<void> {
    if (isDirectory(this.coverageDataDir)) await rmrf(this.coverageDataDir)

    await this.test_cjs()
    await this.test_esm()
  },
})
