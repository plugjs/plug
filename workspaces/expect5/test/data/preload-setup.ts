log('Preload: setup script loaded')
;(globalThis as any).__preloaded = true

beforeAll(() => {
  log('Preload: before all hook executed')
})

afterAll(() => {
  delete (globalThis as any).__preloaded
  log('Preload: after all hook executed')
})
