describe('Expectations tests', () => {
  it('should produce some nice differences for objects', () => {
    expect({ foo: 'bar', hello: 'world', zap: true })
        .toEqual({ foo: 'baz', hello: 'world', zap: false })
  })

  it('should produce some nice differences for arrays', () => {
    expect([ 'foo', 'bar', 'baz' ]).toEqual([ 'baz', 'bar', 'foo' ])
  })

  it('should produce some nice differences for strings', () => {
    expect('The brown fox jumped over the lazy dog')
        .toEqual('The quick fox jumped over the sleeping dog')
  })

  it('should highligt the different types when they differ', () => {
    expect({ foo: 'bar', hello: 'world' } as any)
        .toEqual([ 'foo bar', 'hello world' ] as any)
  })
})
