import type { logging, paths } from '@plugjs/plug'
import type { skip as SkipFunction } from './execution/executable.ts'
import type * as setup from './execution/setup.ts'
import type { expect as ExpectFunction } from './expectation/expect.ts'

declare global {
  const describe: setup.SuiteFunction
  const fdescribe: setup.SuiteSetup
  const xdescribe: setup.SuiteSetup

  const it: setup.SpecFunction
  const fit: setup.SpecSetup
  const xit: setup.SpecSetup

  const afterAll: setup.HookFunction
  const afterEach: setup.HookFunction
  const beforeAll: setup.HookFunction
  const beforeEach: setup.HookFunction

  const xafterAll: setup.HookSetup
  const xafterEach: setup.HookSetup
  const xbeforeAll: setup.HookSetup
  const xbeforeEach: setup.HookSetup

  const skip: typeof SkipFunction

  const expect: typeof ExpectFunction

  const log: logging.LogFunction

  /**
   * Either `import.meta.url` or `__filename` depending on whether we are in
   * an ES module or CommonJS module.
   *
   * @deprecated Use `import.meta.filename` or `__filename`
   */
  const __fileurl: string
  /**
   * Get the directory name from a file URL.
   *
   * @deprecated Use `import.meta.dirname`
   */
  const dirnameFromUrl: typeof paths.dirnameFromUrl
  /**
   * Get the directory name from a file URL.
   *
   * @deprecated Use `import.meta.filename`
   */
  const filenameFromUrl: typeof paths.filenameFromUrl
}
