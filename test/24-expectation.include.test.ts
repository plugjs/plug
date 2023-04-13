import assert from 'node:assert'

import { expectFail, expectPass } from './utils'

describe.skip('Inclusion Expectations', () => {
  it('should fail when the expectation is not recognized', () => {
    assert.throws(() => expect('foo').toInclude('bar' as any), (thrown) => {
      assert(thrown instanceof TypeError, 'Error type')
      assert.strictEqual(thrown.message, 'Invalid type for "toInclude(...)": "bar"')
      return true
    })
  })

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

  describe('values', () => {
    it('should include values from an array', () => {
      expectPass(() => expect([ 1, 2, 3, 4 ]).toInclude([ 1, 2 ]))

      expectFail(() => expect([ 1, 2, 3, 4 ]).toInclude([ 5, 6 ]),
          'Expected <array> to include 2 values', {
            diff: true,
            actual: '[Set]',
            values: [ {
              diff: true,
              actual: '<undefined>',
              expected: '5',
            }, {
              diff: true,
              actual: '<undefined>',
              expected: '6',
            } ],
          })
    })

    it('should include values from a set', () => {
      expectPass(() => expect(new Set([ 1, 2, 3, 4 ])).toInclude(new Set([ 1, 2 ])))

      expectFail(() => expect(new Set([ 1, 2, 3, 4 ])).toInclude(new Set([ 5 ])),
          'Expected [Set] to include 1 value', {
            diff: true,
            actual: '[Set]',
            values: [ {
              diff: true,
              actual: '<undefined>',
              expected: '5',
            } ],
          })
    })

    it('should not include values from an array', () => {
      expectPass(() => expect([ 1, 2, 3, 4 ]).not.toInclude([ 5, 6 ]))

      expectFail(() => expect([ 1, 2, 3, 4 ]).not.toInclude([ 1, 2 ]),
          'Expected <array> not to include 2 values', {
            diff: true,
            actual: '[Set]',
            values: [ {
              diff: true,
              actual: '<undefined>',
              expected: '1',
            }, {
              diff: true,
              actual: '<undefined>',
              expected: '2',
            } ],
          })
    })

    it('should not include values from a set', () => {
      expectPass(() => expect(new Set([ 1, 2, 3, 4 ])).not.toInclude(new Set([ 5, 6 ])))

      expectFail(() => expect(new Set([ 1, 2, 3, 4 ])).not.toInclude(new Set([ 1 ])),
          'Expected [Set] not to include 1 value', {
            diff: true,
            actual: '[Set]',
            values: [ {
              diff: true,
              actual: '<undefined>',
              expected: '1',
            } ],
          })
    })

    it('should fail with the wrong type', () => {
      expectFail(() => expect('foo').toInclude([]), 'Expected "foo" to be an instance of <object>')
      expectFail(() => expect({}).toInclude(new Set()), 'Expected <object> to be an iterable object')
    })
  })
})
