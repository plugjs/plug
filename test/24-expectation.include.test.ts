import { expectFail, expectPass } from './utils'

describe('Inclusion Expectations', () => {
  describe('properties', () => {
    it('should include properties from an object', () => {
      expectPass(() => expect({ a: 'foo', b: 123 }).toInclude({ a: 'foo', b: 123 }))
      expectPass(() => expect({ a: 'foo', b: 123, c: true }).toInclude({ a: 'foo', b: 123 }))
      expectPass(() => expect({ a: 'foo', b: undefined }).toInclude({ a: 'foo', b: undefined }))
      expectPass(() => expect({ o: { a: 'foo' }, a: [ 123, true ], c: true })
          .toInclude({ o: { a: 'foo' }, a: [ 123, true ] }))

      expectFail(() => expect({ a: 'foo' }).toInclude({ a: 'foo', b: 123 }),
          'Expected <object> to include 1 property', {
            diff: true,
            actual: '<object>',
            props: {
              b: {
                diff: true,
                actual: '<undefined>',
                expected: '123',
              },
            },
          })

      expectFail(() => expect({ a: 'foo', b: 123 }).toInclude({ a: 'foo', b: 'bar' }),
          'Expected <object> to include 1 property', {
            diff: true,
            actual: '<object>',
            props: {
              b: {
                diff: true,
                actual: '123',
                expected: '"bar"',
              },
            },
          })

      expectFail(() => expect({ a: 'foo', b: undefined }).toInclude({ a: 'foo', b: 123 }),
          'Expected <object> to include 1 property', {
            diff: true,
            actual: '<object>',
            props: {
              b: {
                diff: true,
                actual: '<undefined>',
                expected: '123',
              },
            },
          })

      expectFail(() => expect({ a: 'foo', b: 123 }).toInclude({ a: 'foo', b: undefined }),
          'Expected <object> to include 1 property', {
            diff: true,
            actual: '<object>',
            props: {
              b: {
                diff: true,
                actual: '123',
                expected: '<undefined>',
              },
            },
          })

      expectFail(
          () => expect({ o: { a: 'foo' }, a: [ 123, true ], c: { x: 123 } })
              .toInclude({ o: { a: 'bar' }, a: [ 123, false ], c: { x: 123 } }),
          'Expected <object> to include 2 properties', {
            diff: true,
            actual: '<object>',
            props: {
              a: {
                diff: true,
                actual: '<array>',
                values: [
                  { diff: false, actual: '123' },
                  { diff: true, actual: 'true', expected: 'false' },
                ],
              },
              o: {
                diff: true,
                actual: '<object>',
                props: {
                  a: { diff: true, actual: '"foo"', expected: '"bar"' },
                },
              },
            },
          })
    })

    it('should not include properties from an object', () => {
      expectPass(() => expect({ a: 'foo', b: 123 }).not.toInclude({ c: 'foo', d: 123 }))

      expectFail(() => expect({ a: 'foo', b: 123 }).not.toInclude({ a: 'foo', b: 123 }),
          'Expected <object> not to include 2 properties', {
            diff: true,
            actual: '<object>',
            props: {
              a: {
                diff: true,
                actual: '"foo"',
                expected: '<undefined>',
              },
              b: {
                diff: true,
                actual: '123',
                expected: '<undefined>',
              },
            },
          })

      expectFail(() => expect({ a: 'foo', b: undefined }).not.toInclude({ a: 'foo', b: undefined }),
          'Expected <object> not to include 2 properties', {
            diff: true,
            actual: '<object>',
            props: {
              a: {
                diff: true,
                actual: '"foo"',
                expected: '<undefined>',
              },
              b: {
                diff: true,
                actual: '<undefined>',
                expected: '<undefined>',
              },
            },
          })

      expectFail(() => expect({ a: 'foo', b: 123 }).not.toInclude({ a: true, b: true }),
          'Expected <object> not to include 2 properties', {
            diff: true,
            actual: '<object>',
            props: {
              a: {
                diff: true,
                actual: '"foo"',
                expected: '<undefined>',
              },
              b: {
                diff: true,
                actual: '123',
                expected: '<undefined>',
              },
            },
          })
    })

    it('should work when including an array', () => {
      expectPass(() => expect([ 123, 'foo' ]).toInclude({
        0: 123, 1: 'foo', // basically array matches...
      }))
      expectPass(() => expect(new Date()).toInclude({
        constructor: Date, // basically, instanceof!
      }))
    })

    it('should fail with the wrong type', () => {
      expectFail(() => expect('foo').toInclude({}), 'Expected "foo" to be an instance of <object>')
      expectFail(() => expect(12345).toInclude({}), 'Expected 12345 to be an instance of <object>')
    })
  })

  describe('mappings', () => {
    function map(object: Record<string, any>): Map<any, any> {
      return new Map(Object.entries(object))
    }

    it('should include mappings from a map', () => {
      expectPass(() => expect(map({ a: 'foo', b: 123 })).toInclude(map({ a: 'foo', b: 123 })))
      expectPass(() => expect(map({ a: 'foo', b: 123, c: true })).toInclude(map({ a: 'foo', b: 123 })))
      expectPass(() => expect(map({ a: 'foo', b: undefined })).toInclude(map({ a: 'foo', b: undefined })))
      expectPass(() => expect(map({ o: { a: 'foo' }, a: [ 123, true ], c: true }))
          .toInclude(map({ o: { a: 'foo' }, a: [ 123, true ] })))

      expectFail(() => expect(map({ a: 'foo' })).toInclude(map({ a: 'foo', b: 123 })),
          'Expected [Map] to include 1 mapping', {
            diff: true,
            actual: '[Map]',
            mappings: [
              [ '"b"', {
                diff: true,
                actual: '<undefined>',
                expected: '123',
              } ],
            ],
          })

      expectFail(() => expect(map({ a: 'foo', b: 123 })).toInclude(map({ a: 'foo', b: 'bar' })),
          'Expected [Map] to include 1 mapping', {
            diff: true,
            actual: '[Map]',
            mappings: [
              [ '"b"', {
                diff: true,
                actual: '123',
                expected: '"bar"',
              } ],
            ],
          })

      expectFail(() => expect(map({ a: 'foo', b: undefined })).toInclude(map({ a: 'foo', b: 123 })),
          'Expected [Map] to include 1 mapping', {
            diff: true,
            actual: '[Map]',
            mappings: [
              [ '"b"', {
                diff: true,
                actual: '<undefined>',
                expected: '123',
              } ],
            ],
          })

      expectFail(() => expect(map({ a: 'foo', b: 123 })).toInclude(map({ a: 'foo', b: undefined })),
          'Expected [Map] to include 1 mapping', {
            diff: true,
            actual: '[Map]',
            mappings: [
              [ '"b"', {
                diff: true,
                actual: '123',
                expected: '<undefined>',
              } ],
            ],
          })

      expectFail(
          () => expect(map({ o: { a: 'foo' }, a: [ 123, true ], c: { x: 123 } }))
              .toInclude(map({ o: { a: 'bar' }, a: [ 123, false ], c: { x: 123 } })),
          'Expected [Map] to include 2 mappings', {
            diff: true,
            actual: '[Map]',
            mappings: [
              [ '"o"', {
                diff: true,
                actual: '<object>',
                props: {
                  a: { diff: true, actual: '"foo"', expected: '"bar"' },
                },
              } ],
              [ '"a"', {
                diff: true,
                actual: '<array>',
                values: [
                  { diff: false, actual: '123' },
                  { diff: true, actual: 'true', expected: 'false' },
                ],
              } ],
            ],
          })
    })

    it('should not include mappings from a map', () => {
      expectPass(() => expect(map({ a: 'foo', b: 123 })).not.toInclude(map({ c: 'foo', d: 123 })))

      expectFail(() => expect(map({ a: 'foo', b: 123 })).not.toInclude(map({ a: 'foo', b: 123 })),
          'Expected [Map] not to include 2 mappings', {
            diff: true,
            actual: '[Map]',
            mappings: [
              [ '"a"', {
                diff: true,
                actual: '"foo"',
                expected: '<undefined>',
              } ],
              [ '"b"', {
                diff: true,
                actual: '123',
                expected: '<undefined>',
              } ],
            ],
          })

      expectFail(() => expect(map({ a: 'foo', b: undefined })).not.toInclude(map({ a: 'foo', b: undefined })),
          'Expected [Map] not to include 2 mappings', {
            diff: true,
            actual: '[Map]',
            mappings: [
              [ '"a"', {
                diff: true,
                actual: '"foo"',
                expected: '<undefined>',
              } ],
              [ '"b"', {
                diff: true,
                actual: '<undefined>',
                expected: '<undefined>',
              } ],
            ],
          })

      expectFail(() => expect(map({ a: 'foo', b: 123 })).not.toInclude(map({ a: true, b: true })),
          'Expected [Map] not to include 2 mappings', {
            diff: true,
            actual: '[Map]',
            mappings: [
              [ '"a"', {
                diff: true,
                actual: '"foo"',
                expected: '<undefined>',
              } ],
              [ '"b"', {
                diff: true,
                actual: '123',
                expected: '<undefined>',
              } ],
            ],
          })
    })

    it('should work when including an array', () => {
      expectPass(() => expect([ 123, 'foo' ]).toInclude({
        0: 123, 1: 'foo', // basically array matches...
      }))
      expectPass(() => expect(new Date()).toInclude({
        constructor: Date, // basically, instanceof!
      }))
    })

    it('should include mappings from an object', () => {
      expectPass(() => expect(map({ a: 'foo', b: 123, c: true })).toInclude({ a: 'foo', b: 123 }))
      expectFail(() => expect(map({ a: 'foo' })).toInclude({ a: 'foo', b: 123 }),
          'Expected [Map] to include 1 mapping', {
            diff: true,
            actual: '[Map]',
            mappings: [
              [ '"b"', {
                diff: true,
                actual: '<undefined>',
                expected: '123',
              } ],
            ],
          })

      expectPass(() => expect(map({ a: 'foo', b: 123 })).not.toInclude({ c: 'foo', d: 123 }))
      expectFail(() => expect(map({ a: 'foo', b: 123 })).not.toInclude({ a: 'foo', b: 123 }),
          'Expected [Map] not to include 2 mappings', {
            diff: true,
            actual: '[Map]',
            mappings: [
              [ '"a"', {
                diff: true,
                actual: '"foo"',
                expected: '<undefined>',
              } ],
              [ '"b"', {
                diff: true,
                actual: '123',
                expected: '<undefined>',
              } ],
            ],
          })
    })

    it('should fail with the wrong type', () => {
      expectFail(() => expect('foo').toInclude(map({})), 'Expected "foo" to be an instance of [Map]')
      expectFail(() => expect(12345).toInclude(map({})), 'Expected 12345 to be an instance of [Map]')
    })
  })
})
