import type { logging, paths } from '@plugjs/plug'
import type { skip as SkipFunction } from './execution/executable'
import type { expect as ExpectFunction } from './expectation/expect'
import type * as setup from './execution/setup'

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
  const dirnameFromUrl: typeof paths.dirnameFromUrl
  const filenameFromUrl: typeof paths.filenameFromUrl
}
