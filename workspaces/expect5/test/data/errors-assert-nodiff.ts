import assert from 'node:assert'

describe('A test suite (error-asserts)', () => {
  it('should throw a node assertion error (1)', () => {
    assert.deepEqual({ foo: 'bar' }, { foo: 'baz' })
  })

  it('should throw a node assertion error (2)', () => {
    assert.deepEqual({ foo: 'bar' }, { foo: 'baz' },
        'This is a custom message\nWith some extra lines!')
  })

  it('should throw a node assertion error (2)', () => {
    assert(false)
  })
})
