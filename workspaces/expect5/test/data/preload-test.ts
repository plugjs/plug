log('Preload: suite script loaded')
// Keep this check to ensure the preload setup has been executed
expect((globalThis as any).__preloaded).toBeTrue()

describe('A test suite (simple)', () => {
  it('should pass a simple test with some preloaded setup', () => {
    log('Preload: test executed')
    expect((globalThis as any).__preloaded).toBeTrue()
  })
})
