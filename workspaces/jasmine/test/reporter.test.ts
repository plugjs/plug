it('should pass a test without suite', () => void 0)
it('should fail a test without suite', () => fail('Fail this'))
xit('should skip a test without suite', () => fail('Should not fail'))

describe('root suite', () => {
  it('should pass a test in a suite', () => void 0)
  it('should fail a test in a suite', () => fail('Fail this'))
  xit('should skip a test in a suite', () => fail('Should not fail'))

  xdescribe('skipped suite', () => {
    it('should skip this test', () => fail('Should not fail'))
    it('should skip this test too', () => fail('Should not fail'))
  })

  describe('nested suite', () => {
    it('should pass a test in a nested suite', () => void 0)
    it('should fail a test in a nested suite', () => fail('Fail this'))
    xit('should skip a test in a nested suite', () => fail('Should not fail'))
  })

  it('should pass a test in the middle of a suite', () => void 0)
  it('should fail a test in the middle of a suite', () => fail('Fail this'))
  xit('should skip a test in the middle of a suite', () => fail('Should not fail'))

  describe('suite failing in "beforeAll"', () => {
    beforeAll(() => fail('Fail this'))
    beforeEach(() => void 0)
    afterEach(() => void 0)
    afterAll(() => void 0)

    it('should fail this test (1)', () => void 0)
    it('should fail this test (2)', () => void 0)
  })

  describe('suite failing in "beforeEach"', () => {
    beforeAll(() => void 0)
    beforeEach(() => fail('Fail this'))
    afterEach(() => void 0)
    afterAll(() => void 0)

    it('should fail this test (1)', () => void 0)
    it('should fail this test (2)', () => void 0)
  })

  describe('suite failing in "afterEach"', () => {
    beforeAll(() => void 0)
    beforeEach(() => void 0)
    afterEach(() => fail('Fail this'))
    afterAll(() => void 0)

    it('should fail this test (1)', () => void 0)
    it('should fail this test (2)', () => void 0)
  })

  describe('suite failing in "afterAll"', () => {
    beforeAll(() => void 0)
    beforeEach(() => void 0)
    afterEach(() => void 0)
    afterAll(() => fail('Fail this'))

    it('should pass this test (1)', () => void 0)
    it('should pass this test (2)', () => void 0)
  })

  describe('empty suite', () => void 0)

  it('should pass a test at the end of a suite', () => void 0)
  it('should fail a test at the end of a suite', () => fail('Fail this'))
  xit('should skip a test at the end of a suite', () => fail('Should not fail'))
})

it('should pass a test after the root suite', () => void 0)
it('should fail a test after the root suite', () => fail('Fail this'))
xit('should skip a test after the root suite', () => fail('Should not fail'))

afterAll(() => fail('Fail this'))
