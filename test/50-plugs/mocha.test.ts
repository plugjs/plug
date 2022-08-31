describe('Mocha', () => {
  it('should warn on slow tests', async function() {
    this.slow(10)

    await new Promise((resolve) => setTimeout(resolve, 20))
  })
})
