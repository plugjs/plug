import assert from 'node:assert'

import { expectFail, expectPass } from './utils'

describe('Inclusion Expectations', () => {
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
          'Expected [Object] to include 1 property', {
            diff: true,
            value: { a: 'foo' },
            props: {
              b: {
                diff: true,
                missing: 123,
              },
            },
          })

      expectFail(() => expect({ a: 'foo', b: 123 }).toInclude({ a: 'foo', b: 'bar' }),
          'Expected [Object] to include 1 property', {
            diff: true,
            value: { a: 'foo', b: 123 },
            props: {
              b: {
                diff: true,
                value: 123,
                expected: 'bar',
              },
            },
          })

      expectFail(() => expect({ a: 'foo', b: undefined }).toInclude({ a: 'foo', b: 123 }),
          'Expected [Object] to include 1 property', {
            diff: true,
            value: { a: 'foo', b: undefined },
            props: {
              b: {
                diff: true,
                value: undefined,
                expected: 123,
              },
            },
          })

      expectFail(() => expect({ a: 'foo', b: 123 }).toInclude({ a: 'foo', b: undefined }),
          'Expected [Object] to include 1 property', {
            diff: true,
            value: { a: 'foo', b: 123 },
            props: {
              b: {
                diff: true,
                value: 123,
                expected: undefined,
              },
            },
          })

      expectFail(
          () => expect({ o: { a: 'foo' }, a: [ 123, true ], c: { x: 123 } })
              .toInclude({ o: { a: 'bar' }, a: [ 123, false ], c: { x: 123 } }),
          'Expected [Object] to include 2 properties', {
            diff: true,
            value: { o: { a: 'foo' }, a: [ 123, true ], c: { x: 123 } },
            props: {
              a: {
                diff: true,
                value: [ 123, true ],
                values: [
                  { diff: false, value: 123 },
                  { diff: true, value: true, expected: false },
                ],
              },
              o: {
                diff: true,
                value: { a: 'foo' },
                props: {
                  a: { diff: true, value: 'foo', expected: 'bar' },
                },
              },
            },
          })
    })

    it('should not include properties from an object', () => {
      expectPass(() => expect({ a: 'foo', b: 123 }).not.toInclude({ c: 'foo', d: 123 }))

      expectFail(() => expect({ a: 'foo', b: 123 }).not.toInclude({ a: 'foo', b: 123 }),
          'Expected [Object] not to include 2 properties', {
            diff: true,
            value: { a: 'foo', b: 123 },
            props: {
              a: {
                diff: true,
                extra: 'foo',
              },
              b: {
                diff: true,
                extra: 123,
              },
            },
          })

      expectFail(() => expect({ a: 'foo', b: undefined }).not.toInclude({ a: 'foo', b: undefined }),
          'Expected [Object] not to include 2 properties', {
            diff: true,
            value: { a: 'foo', b: undefined },
            props: {
              a: {
                diff: true,
                extra: 'foo',
              },
              b: {
                diff: true,
                extra: undefined,
              },
            },
          })

      expectFail(() => expect({ a: 'foo', b: 123 }).not.toInclude({ a: true, b: true }),
          'Expected [Object] not to include 2 properties', {
            diff: true,
            value: { a: 'foo', b: 123 },
            props: {
              a: {
                diff: true,
                extra: 'foo',
              },
              b: {
                diff: true,
                extra: 123,
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
      expectFail(() => expect('foo').toInclude({}), 'Expected "foo" to be an instance of [Object]')
      expectFail(() => expect(12345).toInclude({}), 'Expected 12345 to be an instance of [Object]')
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
          'Expected [Map (1)] to include 1 mapping', {
            diff: true,
            value: map({ a: 'foo' }),
            mappings: [
              [ 'b', { diff: true, missing: 123 } ],
            ],
          })

      expectFail(() => expect(map({ a: 'foo', b: 123 })).toInclude(map({ a: 'foo', b: 'bar' })),
          'Expected [Map (2)] to include 1 mapping', {
            diff: true,
            value: map({ a: 'foo', b: 123 }),
            mappings: [
              [ 'b', { diff: true, value: 123, expected: 'bar' } ],
            ],
          })

      expectFail(() => expect(map({ a: 'foo', b: undefined })).toInclude(map({ a: 'foo', b: 123 })),
          'Expected [Map (2)] to include 1 mapping', {
            diff: true,
            value: map({ a: 'foo', b: undefined }),
            mappings: [
              [ 'b', { diff: true, value: undefined, expected: 123 } ],
            ],
          })

      expectFail(() => expect(map({ a: 'foo', b: 123 })).toInclude(map({ a: 'foo', b: undefined })),
          'Expected [Map (2)] to include 1 mapping', {
            diff: true,
            value: map({ a: 'foo', b: 123 }),
            mappings: [
              [ 'b', { diff: true, value: 123, expected: undefined } ],
            ],
          })

      expectFail(
          () => expect(map({ o: { a: 'foo' }, a: [ 123, true ], c: { x: 123 } }))
              .toInclude(map({ o: { a: 'bar' }, a: [ 123, false ], c: { x: 123 } })),
          'Expected [Map (3)] to include 2 mappings', {
            diff: true,
            value: map({ o: { a: 'foo' }, a: [ 123, true ], c: { x: 123 } }),
            mappings: [
              [ 'o', {
                diff: true,
                value: { a: 'foo' },
                props: {
                  a: { diff: true, value: 'foo', expected: 'bar' },
                },
              } ],
              [ 'a', {
                diff: true,
                value: [ 123, true ],
                values: [
                  { diff: false, value: 123 },
                  { diff: true, value: true, expected: false },
                ],
              } ],
            ],
          })
    })

    it('should not include mappings from a map', () => {
      expectPass(() => expect(map({ a: 'foo', b: 123 })).not.toInclude(map({ c: 'foo', d: 123 })))

      expectFail(() => expect(map({ a: 'foo', b: 123 })).not.toInclude(map({ a: 'foo', b: 123 })),
          'Expected [Map (2)] not to include 2 mappings', {
            diff: true,
            value: map({ a: 'foo', b: 123 }),
            mappings: [
              [ 'a', { diff: true, extra: 'foo' } ],
              [ 'b', { diff: true, extra: 123 } ],
            ],
          })

      expectFail(() => expect(map({ a: 'foo', b: undefined })).not.toInclude(map({ a: 'foo', b: undefined })),
          'Expected [Map (2)] not to include 2 mappings', {
            diff: true,
            value: map({ a: 'foo', b: undefined }),
            mappings: [
              [ 'a', { diff: true, extra: 'foo' } ],
              [ 'b', { diff: true, extra: undefined } ],
            ],
          })

      expectFail(() => expect(map({ a: 'foo', b: 123 })).not.toInclude(map({ a: true, b: true })),
          'Expected [Map (2)] not to include 2 mappings', {
            diff: true,
            value: map({ a: 'foo', b: 123 }),
            mappings: [
              [ 'a', {
                diff: true,
                extra: 'foo',
              } ],
              [ 'b', {
                diff: true,
                extra: 123,
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
          'Expected [Map (1)] to include 1 mapping', {
            diff: true,
            value: map({ a: 'foo' }),
            mappings: [
              [ 'b', { diff: true, missing: 123 } ],
            ],
          })

      expectPass(() => expect(map({ a: 'foo', b: 123 })).not.toInclude({ c: 'foo', d: 123 }))
      expectFail(() => expect(map({ a: 'foo', b: 123 })).not.toInclude({ a: 'foo', b: 123 }),
          'Expected [Map (2)] not to include 2 mappings', {
            diff: true,
            value: map({ a: 'foo', b: 123 }),
            mappings: [
              [ 'a', {
                diff: true,
                extra: 'foo',
              } ],
              [ 'b', {
                diff: true,
                extra: 123,
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
          'Expected [Array (4)] to include 2 values', {
            diff: true,
            value: [ 1, 2, 3, 4 ],
            values: [
              { diff: true, missing: 5 },
              { diff: true, missing: 6 },
            ],
          })
    })

    it('should include values from a set', () => {
      expectPass(() => expect(new Set([ 1, 2, 3, 4 ])).toInclude(new Set([ 1, 2 ])))

      expectFail(() => expect(new Set([ 1, 2, 3, 4 ])).toInclude(new Set([ 5 ])),
          'Expected [Set (4)] to include 1 value', {
            diff: true,
            value: new Set([ 1, 2, 3, 4 ]),
            values: [ { diff: true, missing: 5 } ],
          })
    })

    it('should not include values from an array', () => {
      expectPass(() => expect([ 1, 2, 3, 4 ]).not.toInclude([ 5, 6 ]))

      expectFail(() => expect([ 1, 2, 3, 4 ]).not.toInclude([ 1, 2 ]),
          'Expected [Array (4)] not to include 2 values', {
            diff: true,
            value: [ 1, 2, 3, 4 ],
            values: [
              { diff: true, extra: 1 },
              { diff: true, extra: 2 },
            ],
          })
    })

    it('should not include values from a set', () => {
      expectPass(() => expect(new Set([ 1, 2, 3, 4 ])).not.toInclude(new Set([ 5, 6 ])))

      expectFail(() => expect(new Set([ 1, 2, 3, 4 ])).not.toInclude(new Set([ 1 ])),
          'Expected [Set (4)] not to include 1 value', {
            diff: true,
            value: new Set([ 1, 2, 3, 4 ]),
            values: [ { diff: true, extra: 1 } ],
          })
    })

    it('should fail with the wrong type', () => {
      expectFail(() => expect('foo').toInclude([]), 'Expected "foo" to be an instance of [Object]')
      expectFail(() => expect({}).toInclude(new Set()), 'Expected [Object] to be an iterable object')
    })
  })

  describe('contents matching', () => {
    it('should match all contents', () => {
      expectPass(() => expect([ 'one', true, 123 ]).toMatchContents([ true, 123, 'one' ]))
      expectPass(() => expect(new Set([ 'one', true, 123 ])).toMatchContents([ true, 123, 'one' ]))
      expectPass(() => expect([ 'one', true, 123 ]).toMatchContents(new Set([ true, 123, 'one' ])))

      expectFail(() => expect([ 'one', false ]).toMatchContents([ true, 123, 'one' ]),
          'Expected [Array (2)] to match contents of [Array]', {
            diff: true,
            value: [ 'one', false ],
            values: [
              { 'diff': false, 'value': 'one' },
              { 'diff': true, 'extra': false },
              { 'diff': true, 'missing': true },
              { 'diff': true, 'missing': 123 },
            ],
          })
      expectFail(() => expect(new Set([ 'one', 345 ])).toMatchContents(new Set([ true, 123, 'one' ])),
          'Expected [Set (2)] to match contents of [Set]', {
            diff: true,
            value: new Set([ 'one', 345 ]),
            values: [
              { 'diff': false, 'value': 'one' },
              { 'diff': true, 'extra': 345 },
              { 'diff': true, 'missing': true },
              { 'diff': true, 'missing': 123 },
            ],
          })
    })

    it('should not match all contents', () => {
      expectFail(() => expect([ 'one', true, 123 ]).not.toMatchContents([ true, 123, 'one' ]),
          'Expected [Array (3)] not to match contents of [Array]', {
            diff: false,
            value: [ 'one', true, 123 ],
            values: [
              { 'diff': false, 'value': 'one' },
              { 'diff': false, 'value': true },
              { 'diff': false, 'value': 123 },
            ] })
      expectFail(() => expect(new Set([ 'one', true, 123 ])).not.toMatchContents([ true, 123, 'one' ]),
          'Expected [Set (3)] not to match contents of [Array]', {
            diff: false,
            value: new Set([ 'one', true, 123 ]),
            values: [
              { 'diff': false, 'value': 'one' },
              { 'diff': false, 'value': true },
              { 'diff': false, 'value': 123 },
            ] })

      expectPass(() => expect([ 'one', false ]).not.toMatchContents([ true, 123, 'one' ]))
      expectPass(() => expect(new Set([ 'one', 345 ])).not.toMatchContents([ true, 123, 'one' ]))
    })

    it('should not match contents of a non-iterable', () => {
      expectFail(() => expect({}).toMatchContents([]), 'Expected [Object] to be an iterable object')
      expectFail(() => expect({}).not.toMatchContents([]), 'Expected [Object] to be an iterable object')
    })
  })
})
