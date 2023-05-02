describe('A test suite (errors)', () => {
  it('should throw a simple error', () => {
    throw new Error('Fail me!')
  })

  it('should throw an error with extra properties', () => {
    const error = new Error('Fail me!') as Error & Record<string, any>
    error.str = 'test'
    error.num = 12345
    error.sym = Symbol.for('foobar')
    error.null = null
    error.none = undefined
    throw error
  })

  it('should throw a string', () => {
    // eslint-disable-next-line no-throw-literal
    throw 'This is not an error!'
  })

  it('should throw an error with no stack', () => {
    const error = new Error('This has no stack!')
    error.stack = ''
    throw error
  })

  it('should throw an error with no message', () => {
    throw new Error()
  })

  it('should throw an expectation error with a diff', () => {
    expect({ foo: 'bar' }).toEqual({ foo: 'baz' })
  })

  it('should throw an expectation error without a diff', () => {
    expect('foo').toBeA('function')
  })

  it('should throw an expectation error with some remarks', () => {
    expect({ foo: 'bar' }, 'some remarks').toEqual({ foo: 'baz' })
  })
})
