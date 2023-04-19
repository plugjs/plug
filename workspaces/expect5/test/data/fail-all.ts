describe('A test suite (fail-all)', () => {
  beforeAll(() => {
    throw new Error('Fail me!')
  })
  it('should skip a test because of hook failures', () => void 0)
})
