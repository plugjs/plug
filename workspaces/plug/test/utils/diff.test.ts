import { $grn, $red, logOptions } from '../../src/logging'
import { diff, textDiff } from '../../src/utils/diff'

describe('Myers Diff Algorithm', function() {
  describe('Primitives (strings)', () => {
    it('should compare strings (change at the end)', function() {
      const changes = diff(
          'the quick red fox jumped',
          'the quick red fox swam',
      )

      expect(changes.length).toStrictlyEqual(2)
      const [ first, second ] = changes

      expect(first).toEqual({
        lhsPos: 18, // delete: 'ju'
        lhsDel: 2,
        rhsPos: 18, // add: 'swa'
        rhsAdd: 3,
      })

      expect(second).toEqual({
        lhsPos: 21, // delete: 'ped'
        lhsDel: 3,
        rhsPos: 21, // add: ''
        rhsAdd: 0,
      })
    })

    it('should compare strings (change at the start)', function() {
      const changes = diff(
          'the quick red fox jumped',
          'The quick red fox jumped',
      )

      expect(changes.length).toStrictlyEqual(1)
      const [ change ] = changes

      expect(change).toEqual({
        lhsPos: 0, // delete: 'T'
        lhsDel: 1,
        rhsPos: 0, // add: 't'
        rhsAdd: 1,
      })
    })

    it('should compare strings (single change in the middle)', function() {
      const changes = diff(
          'the quick red fox jumped',
          'the quick red fox Jumped',
      )

      expect(changes.length).toStrictlyEqual(1)
      const [ change ] = changes

      expect(change).toEqual({
        lhsPos: 18, // delete: 'j'
        lhsDel: 1,
        rhsPos: 18, // add: 'J'
        rhsAdd: 1,
      })
    })

    it('should compare strings (change in the middle)', function() {
      const changes = diff(
          'the quick red fox jumped',
          'the quick RED fox jumped',
      )

      expect(changes.length).toStrictlyEqual(1)
      const [ change ] = changes

      expect(change).toEqual({
        lhsPos: 10, // delete: 'red'
        lhsDel: 3,
        rhsPos: 10, // add: 'RED'
        rhsAdd: 3,
      })
    })

    it('should compare strings (add at the start)', function() {
      const changes = diff(
          'the quick red fox jumped',
          '*the quick red fox jumped',
      )

      expect(changes.length).toStrictlyEqual(1)
      const [ change ] = changes

      expect(change).toEqual({
        lhsPos: 0, // delete: ''
        lhsDel: 0,
        rhsPos: 0, // add: '*'
        rhsAdd: 1,
      })
    })

    it('should compare strings (add at the end)', function() {
      const changes = diff(
          'the quick red fox jumped',
          'the quick red fox jumped*',
      )

      expect(changes.length).toStrictlyEqual(1)
      const [ change ] = changes

      expect(change).toEqual({
        lhsPos: 23, // delete: ''
        lhsDel: 0,
        rhsPos: 24, // add: '*'
        rhsAdd: 1,
      })
    })

    it('should compare strings (delete at the start)', function() {
      const changes = diff(
          '*the quick red fox jumped',
          'the quick red fox jumped',
      )

      expect(changes.length).toStrictlyEqual(1)
      const [ change ] = changes

      expect(change).toEqual({
        lhsPos: 0, // delete: '*'
        lhsDel: 1,
        rhsPos: 0, // add: ''
        rhsAdd: 0,
      })
    })

    it('should compare strings (delete at the end)', function() {
      const changes = diff(
          'the quick red fox jumped*',
          'the quick red fox jumped',
      )

      expect(changes.length).toStrictlyEqual(1)
      const [ change ] = changes

      expect(change).toEqual({
        lhsPos: 24, // delete: '*'
        lhsDel: 1,
        rhsPos: 23, // add: ''
        rhsAdd: 0,
      })
    })

    it('should compare strings (multiple changes in the middle)', function() {
      const changes = diff(
          'the quick red scared fox jumped',
          'the quick orange fox jumped',
      )

      expect(changes.length).toStrictlyEqual(4)
      const [ first, second, third, fourth ] = changes

      expect(first).toEqual({
        lhsPos: 10, // deleted: nothing
        lhsDel: 0,
        rhsPos: 10, // added: 'o'
        rhsAdd: 1,
      })

      expect(second).toEqual({
        lhsPos: 11, // deleted: 'ed sc'
        lhsDel: 5,
        rhsPos: 12, // added: nothing
        rhsAdd: 0,
      })

      expect(third).toEqual({
        lhsPos: 17, // deleted: 'r'
        lhsDel: 1,
        rhsPos: 13, // added: 'ng'
        rhsAdd: 2,
      })

      expect(fourth).toEqual({
        lhsPos: 19, // deleted: 'r'
        lhsDel: 1,
        rhsPos: 16, // added: nothing
        rhsAdd: 0,
      })
    })

    it('should compare strings (add a whole string)', function() {
      const changes = diff(
          '',
          'the quick red fox jumped',
      )

      expect(changes.length).toStrictlyEqual(1)
      const [ change ] = changes

      expect(change).toEqual({
        lhsPos: 0, // delete: ''
        lhsDel: 0,
        rhsPos: 0, // add: 'the quick red fox jumped'
        rhsAdd: 24,
      })
    })

    it('should compare strings (delete a whole string)', function() {
      const changes = diff(
          'the quick red fox jumped',
          '',
      )

      expect(changes.length).toStrictlyEqual(1)
      const [ change ] = changes

      expect(change).toEqual({
        lhsPos: 0, // delete: 'the quick red fox jumped'
        lhsDel: 24,
        rhsPos: 0, // add: ''
        rhsAdd: 0,
      })
    })

    it('should compare strings (no changes)', function() {
      const changes = diff(
          'the quick red fox jumped',
          'the quick red fox jumped',
      )

      expect(changes.length).toStrictlyEqual(0)
    })
  })

  describe('Array of objects', () => {
    it('should compare arrays of objects (delete all)', function() {
      const changes = diff(
          [ { foo: 'bar' }, { baz: 12345 }, { hello: 'world' } ],
          [ ],
      )

      expect(changes.length).toStrictlyEqual(1)
      const [ change ] = changes

      expect(change).toEqual({
        lhsPos: 0, // delete: [ { foo: 'bar' }, { baz: 12345 }, { hello: 'world' } ]
        lhsDel: 3,
        rhsPos: 0, // add: []
        rhsAdd: 0,
      })
    })

    it('should compare arrays of objects (add all)', function() {
      const changes = diff(
          [ ],
          [ { foo: 'bar' }, { baz: 12345 }, { hello: 'world' } ],
      )

      expect(changes.length).toStrictlyEqual(1)
      const [ change ] = changes

      expect(change).toEqual({
        lhsPos: 0, // delete: []
        lhsDel: 0,
        rhsPos: 0, // add: [ { foo: 'bar' }, { baz: 12345 }, { hello: 'world' } ]
        rhsAdd: 3,
      })
    })

    it('should compare arrays of objects (add)', function() {
      const changes = diff(
          [ { foo: 'bar' }, { hello: 'world' } ],
          [ { foo: 'bar' }, { baz: 12345 }, { hello: 'world' } ],
      )

      expect(changes.length).toStrictlyEqual(1)
      const [ change ] = changes

      expect(change).toEqual({
        lhsPos: 1, // delete: []
        lhsDel: 0,
        rhsPos: 1, // add: [ { baz: 12345 } ]
        rhsAdd: 1,
      })
    })

    it('should compare arrays of objects (remove)', function() {
      const changes = diff(
          [ { foo: 'bar' }, { baz: 12345 }, { hello: 'world' } ],
          [ { foo: 'bar' }, { hello: 'world' } ],
      )

      expect(changes.length).toStrictlyEqual(1)
      const [ change ] = changes

      expect(change).toEqual({
        lhsPos: 1, // delete: [ { baz: 12345 } ]
        lhsDel: 1,
        rhsPos: 1, // add: []
        rhsAdd: 0,
      })
    })

    it('should compare arrays of objects (change)', function() {
      const changes = diff(
          [ { foo: 'bar' }, { baz: 12345 }, { hello: 'world' } ],
          [ { foo: 'bar' }, { baz: 54321 }, { hello: 'world' } ],
      )

      expect(changes.length).toStrictlyEqual(1)
      const [ change ] = changes

      expect(change).toEqual({
        lhsPos: 1, // delete: [ { baz: 12345 } ]
        lhsDel: 1,
        rhsPos: 1, // add: [ { baz: 54321 } ]
        rhsAdd: 1,
      })
    })

    it('should compare arrays of objects (change with nulls)', function() {
      const changes = diff(
          [ null, { baz: 12345 }, { baz: 12345 }, { hello: 'world' } ],
          [ { foo: 'bar' }, { baz: 12345 }, { baz: 12345 }, null ],
      )

      expect(changes.length).toStrictlyEqual(2)
      const [ first, second ] = changes

      expect(first).toEqual({
        lhsPos: 0, // delete: [ null ]
        lhsDel: 1,
        rhsPos: 0, // add: [ { foo: 'bar' } ]
        rhsAdd: 1,
      })

      expect(second).toEqual({
        lhsPos: 3, // delete: [ { hello: 'world' } ]
        lhsDel: 1,
        rhsPos: 3, // add: [ null ]
        rhsAdd: 1,
      })
    })

    it('should compare arrays of objects (same)', function() {
      const changes = diff(
          [ { foo: 'bar' }, { baz: 12345 }, { hello: 'world' } ],
          [ { foo: 'bar' }, { baz: 12345 }, { hello: 'world' } ],
      )

      expect(changes.length).toStrictlyEqual(0)
    })
  })
})

describe('Textual diff', () => {
  it('should produce some colorized diff', () => {
    const colors = logOptions.colors
    try {
      logOptions.colors = true
      expect(textDiff([ 'hello' ], [ 'world' ]))
          .toStrictlyEqual([
            '[',
            $red('  \'hello\''),
            $grn('  \'world\''),
            ']',
          ].join('\n'))
    } finally {
      logOptions.colors = colors
    }
  })

  it('should produce some black-and-white diff', () => {
    const colors = logOptions.colors
    try {
      logOptions.colors = false
      expect(textDiff([ 'hello' ], [ 'world' ]))
          .toStrictlyEqual([
            '  [',
            '-   \'hello\'',
            '+   \'world\'',
            '  ]',
          ].join('\n'))
    } finally {
      logOptions.colors = colors
    }
  })

  it('should sort object keys', () => {
    const add = (s: string): string => `+${s}`
    const del = (s: string): string => `-${s}`
    const not = (s: string): string => `=${s}`

    expect(textDiff({ a: 1, b: 2, c: 3 }, { c: 1, b: 2, a: 3 }, add, del, not))
        .toStrictlyEqual([
          '={',
          '-  a: 1,',
          '+  a: 3,',
          '=  b: 2,',
          '-  c: 3',
          '+  c: 1',
          '=}',
        ].join('\n'))
  })

  it('should work with strings', () => {
    const add = (s: string): string => `+${s}`
    const del = (s: string): string => `-${s}`
    const not = (s: string): string => `=${s}`

    expect(textDiff('foo1\nfoo2\nbar\nbaz', 'baz\nbar\nfoo1\nfoo2', add, del, not))
        .toStrictlyEqual([
          '+baz',
          '+bar',
          '=foo1',
          '=foo2',
          '-bar',
          '-baz',
        ].join('\n'))
  })

  it('should work with undefined', () => {
    const add = (s: string): string => `+${s}`
    const del = (s: string): string => `-${s}`
    const not = (s: string): string => `=${s}`

    expect(textDiff('foo', undefined, add, del, not)).toStrictlyEqual('-\'foo\'\n+undefined')
    expect(textDiff(undefined, 'foo', add, del, not)).toStrictlyEqual('-undefined\n+\'foo\'')
  })

  it('should return an empty string when there are no differences', () => {
    expect(textDiff('foo', 'foo')).toStrictlyEqual('')
    expect(textDiff([ 123 ], [ 123 ])).toStrictlyEqual('')
    expect(textDiff({ foo: 'bar' }, { foo: 'bar' })).toStrictlyEqual('')
  })
})
