describe('A test suite (fail-each)', () => {
  beforeEach(() => {
    throw new Error('Fail me!')
  })
  it('should skip a test because of hook failures', () => void 0)
})
