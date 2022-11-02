import { log } from '../../src/logging'

describe('Mocha', () => {
  it('should warn on slow tests', async function() {
    this.slow(10)

    await new Promise((resolve) => setTimeout(resolve, 20))
  })

  describe.skip('skip', () => {
    it('should skip this test (1)', () => {})
    it('should skip this test (2)', () => {})
    it('should skip this test (3)', () => {})
    it('should skip this test (4)', () => {})
    it('should skip this test (5)', () => {})
    it('should skip this test (6)', () => {})
  })

  describe('skip inside', () => {
    it('should run this test', () => {})
    it('should skip this test (outside)', () => {})
    it('should skip this test (inside)', function() {
      this.skip()
    })
    it('should skip this test (log and skip)', function() {
      log.notice('This is being skipped')
      this.skip()
    })
    it('should run this test (again)', () => {})
  })
})
