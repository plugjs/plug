import { Hook, Spec, Suite, getCurrentSuite, type Call } from './executable'

export type SuiteSetup = (name: string, call: Call, timeout?: number) => void
export type SuiteFunction = SuiteSetup & {
  only: SuiteSetup,
  skip: SuiteSetup,
}

export const describe: SuiteFunction = (name: string, call: Call, timeout?: number): void => {
  const parent = getCurrentSuite()
  parent.addSuite(new Suite(parent, name, call, timeout))
}

export const fdescribe: SuiteSetup = (name: string, call: Call, timeout?: number): void => {
  const parent = getCurrentSuite()
  parent.addSuite(new Suite(parent, name, call, timeout, 'only'))
}

export const xdescribe: SuiteSetup = (name: string, call: Call, timeout?: number): void => {
  const parent = getCurrentSuite()
  parent.addSuite(new Suite(parent, name, call, timeout, 'skip'))
}

describe.skip = xdescribe
describe.only = fdescribe

/* ========================================================================== */

export type SpecSetup = (name: string, call: Call, timeout?: number) => void
export type SpecFunction = SpecSetup & {
  only: SpecSetup,
  skip: SpecSetup,
}

export const it: SpecFunction = (name: string, call: Call, timeout?: number): void => {
  const parent = getCurrentSuite()
  parent.addSpec(new Spec(parent, name, call, timeout))
}

export const fit: SpecSetup = (name: string, call: Call, timeout?: number): void => {
  const parent = getCurrentSuite()
  parent.addSpec(new Spec(parent, name, call, timeout, 'only'))
}

export const xit: SpecSetup = (name: string, call: Call, timeout?: number): void => {
  const parent = getCurrentSuite()
  parent.addSpec(new Spec(parent, name, call, timeout, 'skip'))
}

it.skip = xit
it.only = fit

/* ========================================================================== */

export type HookSetup = (call: Call, timeout?: number) => void
export type HookFunction = HookSetup & {
  skip: HookSetup,
}

export const beforeAll: HookFunction = (call: Call, timeout?: number): void => {
  const parent = getCurrentSuite()
  parent.addBeforeAllHook(new Hook(parent, 'beforeAll', call, timeout))
}

export const xbeforeAll: HookSetup = (call: Call, timeout?: number): void => {
  const parent = getCurrentSuite()
  parent.addBeforeAllHook(new Hook(parent, 'beforeAll', call, timeout, 'skip'))
}

export const beforeEach: HookFunction = (call: Call, timeout?: number): void => {
  const parent = getCurrentSuite()
  parent.addBeforeEachHook(new Hook(parent, 'beforeEach', call, timeout))
}

export const xbeforeEach: HookSetup = (call: Call, timeout?: number): void => {
  const parent = getCurrentSuite()
  parent.addBeforeEachHook(new Hook(parent, 'beforeEach', call, timeout, 'skip'))
}

export const afterAll: HookFunction = (call: Call, timeout?: number): void => {
  const parent = getCurrentSuite()
  parent.addAfterAllHook(new Hook(parent, 'afterAll', call, timeout))
}

export const xafterAll: HookSetup = (call: Call, timeout?: number): void => {
  const parent = getCurrentSuite()
  parent.addAfterAllHook(new Hook(parent, 'afterAll', call, timeout, 'skip'))
}

export const afterEach: HookFunction = (call: Call, timeout?: number): void => {
  const parent = getCurrentSuite()
  parent.addAfterEachHook(new Hook(parent, 'afterEach', call, timeout))
}

export const xafterEach: HookSetup = (call: Call, timeout?: number): void => {
  const parent = getCurrentSuite()
  parent.addAfterEachHook(new Hook(parent, 'afterEach', call, timeout, 'skip'))
}

beforeAll.skip = xbeforeAll
beforeEach.skip = xbeforeEach
afterAll.skip = xafterAll
afterEach.skip = xafterEach

export const before: HookSetup = beforeAll
export const after: HookSetup = afterAll
