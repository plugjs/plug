describe('A test suite (simple)', () => {
  it('should pass a simple test', () => null)
  it('should pass and highlight a slow test', async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 80))
  }, 100)
})
