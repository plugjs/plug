/* eslint-disable no-new-wrappers */
import { TestLogger, logOptions } from '@plugjs/plug/logging'

import { diff } from '../src/expectation/diff'
import { printDiff } from '../src/expectation/print'

import type { Diff } from '../src/expectation/diff'

describe('Diff Printer Format', () => {
  const logger = new TestLogger()

  afterEach(() => logger.reset())

  function map(object: Record<string, any>): Map<any, any> {
    return new Map(Object.entries(object))
  }

  function print(diff: Diff, value: string[]): void {
    const colors = logOptions.colors
    logOptions.colors = false
    try {
      printDiff(logger, diff, false)
    } finally {
      logOptions.colors = colors
    }
    expect(logger.buffer).toStrictlyEqual(value.join('\n'))
  }

  /* ======================================================================== */

  describe('values dump', () => {
    it('should dump a primitive', () => {
      print({ diff: false, value: 123 }, [
        '123',
      ])
    })

    it('should dump a simple object', () => {
      print({ diff: false, value: { foo: 'bar' } }, [
        '{',
        '  "foo": "bar",',
        '}',
      ])
    })

    it('should dump an array', () => {
      print({ diff: false, value: [ 1, true, { foo: 'bar' } ] }, [
        '[',
        '  1,',
        '  true,',
        '  {',
        '    "foo": "bar",',
        '  },',
        ']',
      ])
    })

    it('should dump a set', () => {
      print({ diff: false, value: new Set([ 1, true, { foo: 'bar' } ]) }, [
        '[Set (3)] [',
        '  1,',
        '  true,',
        '  {',
        '    "foo": "bar",',
        '  },',
        ']',
      ])
    })

    it('should dump a map', () => {
      print({ diff: false, value: map({ foo: 'bar', hello: [ 'world', 'planet' ], extra: true }) }, [
        '[Map (3)] {',
        '  "foo" => "bar",',
        '  "hello" => [',
        '    "world",',
        '    "planet",',
        '  ],',
        '  "extra" => true,',
        '}',
      ])
    })

    it('should dump a slightly more complex object', () => {
      print({ diff: false, value: { foo: 'bar', hello: [ 'world', 'planet' ], extra: true } }, [
        '{',
        '  "foo": "bar",',
        '  "hello": [',
        '    "world",',
        '    "planet",',
        '  ],',
        '  "extra": true,',
        '}',
      ])
    })

    it('should dump an array with extra properties', () => {
      const value = Object.assign([ 1, true, { foo: 'bar' } ], { extra: true })
      print({ diff: false, value }, [
        '[',
        '  1,',
        '  true,',
        '  {',
        '    "foo": "bar",',
        '  },',
        '] … extra props … {',
        '  "extra": true,',
        '}',
      ])
    })

    it('should dump a set with extra properties', () => {
      const value = Object.assign(new Set([ 1, true, { foo: 'bar' } ]), { extra: true })
      print({ diff: false, value }, [
        '[Set (3)] [',
        '  1,',
        '  true,',
        '  {',
        '    "foo": "bar",',
        '  },',
        '] … extra props … {',
        '  "extra": true,',
        '}',
      ])
    })

    it('should dump a map with extra properties', () => {
      const value = Object.assign(map({ foo: 'bar', hello: [ 'world', 'planet' ] }), { extra: true })
      print({ diff: false, value }, [
        '[Map (2)] {',
        '  "foo" => "bar",',
        '  "hello" => [',
        '    "world",',
        '    "planet",',
        '  ],',
        '} … extra props … {',
        '  "extra": true,',
        '}',
      ])
    })

    it('should dump an empty object', () => {
      print({ diff: false, value: {} }, [
        '{}',
      ])
    })

    it('should dump an empty array', () => {
      print({ diff: false, value: [] }, [
        '[]',
      ])
    })

    it('should dump an empty array with extra properties', () => {
      print({ diff: false, value: Object.assign([], { extra: true }) }, [
        '[] … extra props … {',
        '  "extra": true,',
        '}',
      ])
    })

    it('should dump an empty set', () => {
      print({ diff: false, value: new Set([]) }, [
        '[Set (0)] []',
      ])
    })

    it('should dump an empty set with extra properties', () => {
      print({ diff: false, value: Object.assign(new Set([]), { extra: true }) }, [
        '[Set (0)] [] … extra props … {',
        '  "extra": true,',
        '}',
      ])
    })

    it('should dump an empty map', () => {
      print({ diff: false, value: map({}) }, [
        '[Map (0)] {}',
      ])
    })

    it('should dump an empty map with extra properies', () => {
      print({ diff: false, value: Object.assign(map({}), { extra: true }) }, [
        '[Map (0)] {} … extra props … {',
        '  "extra": true,',
        '}',
      ])
    })

    it('should dump a test object', () => {
      const value = {
        string: 'foo',
        number: 12345,
        boolean: true,
        boxed: new String('bar'),
        boexd_with_props: Object.assign(new String('baz'), { extra: true }),
        regexp: /abc/gi,
        regexp_with_props: Object.assign(/abc/gi, { extra: true }),
        circular: { deep: {} },
      }
      value.circular.deep = value

      print({ diff: false, value }, [
        '{',
        '  "string": "foo",',
        '  "number": 12345,',
        '  "boolean": true,',
        '  "boxed": [String: "bar"] {},',
        '  "boexd_with_props": [String: "baz"] {',
        '    "extra": true,',
        '  },',
        '  "regexp": /abc/gi {},',
        '  "regexp_with_props": /abc/gi {',
        '    "extra": true,',
        '  },',
        '  "circular": {',
        '    "deep": <circular 0>,',
        '  },',
        '}',
      ])
    })
  })

  /* ======================================================================== */

  describe('base diff', () => {
    it('should print the difference between two equal primitives', () => {
      print(diff(123, 123), [
        '123',
      ])
    })

    it('should print the difference between two equal objects', () => {
      print(diff(
          { foo: 123, bar: true, baz: { hello: 'world' } },
          { foo: 123, bar: true, baz: { hello: 'world' } },
      ), [
        '{',
        '  "foo": 123,',
        '  "bar": true,',
        '  "baz": {',
        '    "hello": "world",',
        '  },',
        '}',
      ])
    })

    it('should print the difference between two equal arrays', () => {
      print(diff([ 1, true, { hello: 'world' } ], [ 1, true, { hello: 'world' } ]), [
        '[',
        '  1,',
        '  true,',
        '  {',
        '    "hello": "world",',
        '  },',
        ']',
      ])
    })

    it('should print the difference between two equal maps', () => {
      print(diff(
          map({ foo: 123, bar: true, baz: { hello: 'world' } }),
          map({ foo: 123, bar: true, baz: { hello: 'world' } }),
      ), [
        '[Map (3)] {',
        '  "foo" => 123,',
        '  "bar" => true,',
        '  "baz" => {',
        '    "hello": "world",',
        '  },',
        '}',
      ])
    })

    it('should print the difference between two equal sets', () => {
      print(diff(new Set([ 1, true, { hello: 'world' } ]), new Set([ 1, true, { hello: 'world' } ])), [
        '[Set (3)] [',
        '  1,',
        '  true,',
        '  {',
        '    "hello": "world",',
        '  },',
        ']',
      ])
    })

    it('should print the difference between two empty objects', () => {
      print({ diff: true, value: {} } satisfies Diff, [
        '(differs) {}',
      ])
    })

    it('should print the difference without known changes', () => {
      print({ diff: true, value: { foo: 'bar' } } satisfies Diff, [
        '(differs) {',
        '  "foo": "bar",',
        '}',
      ])
    })

    it('should print the difference with empty values', () => {
      print({ diff: true, value: { foo: 'bar' }, values: [] } satisfies Diff, [
        '[]', // edge case... should never have an object diff without subdiffs
      ])
    })

    it('should print the difference with empty mappings', () => {
      print({ diff: true, value: { foo: 'bar' }, mappings: [] } satisfies Diff, [
        '{}', // edge case... should never have an object diff without subdiffs
      ])
    })

    it('should print the difference with empty properties', () => {
      print({ diff: true, value: { foo: 'bar' }, props: {} } satisfies Diff, [
        '{}', // edge case... should never have an object diff without subdiffs
      ])
    })

    it('should print the difference between two equal arrays with extra properties', () => {
      const foo = Object.assign([ 1, true, { hello: 'world' } ], { extra: true })
      const bar = Object.assign([ 1, true, { hello: 'world' } ], { extra: true })
      print(diff(foo, bar), [
        '[',
        '  1,',
        '  true,',
        '  {',
        '    "hello": "world",',
        '  },',
        '] … extra props … {',
        '  "extra": true,',
        '}',
      ])
    })

    it('should print the difference between two equal maps with extra properties', () => {
      const foo = Object.assign(map({ foo: 123, bar: true, baz: { hello: 'world' } }), { extra: true })
      const bar = Object.assign(map({ foo: 123, bar: true, baz: { hello: 'world' } }), { extra: true })
      print(diff(foo, bar), [
        '[Map (3)] {',
        '  "foo" => 123,',
        '  "bar" => true,',
        '  "baz" => {',
        '    "hello": "world",',
        '  },',
        '} … extra props … {',
        '  "extra": true,',
        '}',
      ])
    })
  })

  /* ======================================================================== */

  describe('value diff', () => {
    it('should print the difference between two different primitives', () => {
      print(diff(123, 321), [
        '123 ~ 321',
      ])
    })

    it('should print the difference between two different strings', () => {
      print(diff('hello', 'world'), [
        '(string)',
        '  - hello',
        '  + world',
      ])
    })

    it('should print the difference between two different multiline strings', () => {
      print(diff('one for\xA0all\ntwo\nthree\x1A', 'all for\vone\ntwo\n3\t4'), [
        '(string)',
        '  - one\u00b7for\\A0all',
        '  + all\u00b7for\\0Bone',
        '    two',
        '  - three\\1A',
        '  + 3 \u2192 4',
      ])
    })

    it('should print the difference between a primitive and an object (1)', () => {
      print(diff(123, { foo: 'bar' }), [
        '123 ~ {',
        '  "foo": "bar",',
        '}',
      ])
    })

    it('should print the difference between a primitive and an object (2)', () => {
      print(diff({ key: 123 }, { key: { foo: 'bar' } }), [
        '{',
        '  "key": 123 ~ {',
        '    "foo": "bar",',
        '  },',
        '}',
      ])
    })

    it('should print the difference between an object and a primitive (1)', () => {
      print(diff({ foo: 'bar' }, 123), [
        '{',
        '  "foo": "bar",',
        '} ~ 123',
      ])
    })

    it('should print the difference between an object and a primitive (2)', () => {
      print(diff({ key: { foo: 'bar' } }, { key: 123 }), [
        '{',
        '  "key": {',
        '    "foo": "bar",',
        '  } ~ 123,',
        '}',
      ])
    })

    it('should print the difference between two different objects (1)', () => {
      print(diff(
          { foo: 123, bar: true, baz: { hello: 'planet' } },
          { foo: 321, bar: false, baz: { hello: 'world' } },
      ), [
        '{',
        '  "foo": 123 ~ 321,',
        '  "bar": true ~ false,',
        '  "baz": {',
        '    "hello": (string)',
        '      - planet',
        '      + world',
        '  },',
        '}',
      ])
    })

    it('should print the difference between two different objects (2)', () => {
      print(diff(
          { foo: 123, bar: true, baz: { hello: 'planet' } },
          { foo: 321, bar: false, xyz: { hello: 'world' } },
      ), [
        '{',
        '  "foo": 123 ~ 321,',
        '  "bar": true ~ false,',
        '  (extra) "baz": {',
        '    "hello": "planet",',
        '  },',
        '  (missing) "xyz": {',
        '    "hello": "world",',
        '  },',
        '}',
      ])
    })

    it('should print the difference between two different objects (3)', () => {
      print({ diff: true, value: { foo: 'bar' }, expected: { baz: 123 } }, [
        '{',
        '  "baz": 123,',
        '} ~ {',
        '  "foo": "bar",',
        '}',
      ]) // edge case, normally we'd list the properties differing here...
    })

    it('should print the difference between two different objects (4)', () => {
      print({ diff: true, value: map({ foo: 'bar' }), expected: new Set([ 1 ]) }, [
        '[Set (1)] [',
        '  1,',
        '] ~ [Map (1)] {',
        '  "foo" => "bar",',
        '}',
      ]) // edge case: we normally have an "error" too
    })

    it('should print the difference between two different objects (5)', () => {
      print(diff(map({ foo: 'bar' }), new Set([ 1 ])), [
        '[Set (1)] [',
        '  1,',
        '] ~ [Map (1)] {',
        '  "foo" => "bar",',
        '} (error) Expected [Map (1)] to be instance of [Set]',
      ])
    })

    it('should print the difference between two different arrays', () => {
      print(diff(
          [ 1, true, { hello: 'planet' } ],
          [ 1, false, { hello: 'world' } ],
      ), [
        '[',
        '  1,',
        '  true ~ false,',
        '  {',
        '    "hello": (string)',
        '      - planet',
        '      + world',
        '  },',
        ']',
      ])
    })

    it('should print the difference between two different maps', () => {
      print(diff(
          map({ foo: 123, bar: true, baz: { hello: 'planet' } }),
          map({ foo: 123, bar: false, baz: { hello: 'world' } }),
      ), [
        '[Map (3)] {',
        '  "foo" => 123,',
        '  "bar" => true ~ false,',
        '  "baz" => {',
        '    "hello": (string)',
        '      - planet',
        '      + world',
        '  },',
        '}',
      ])
    })

    it('should print the difference between two different arrays with extra properties', () => {
      const foo = Object.assign([ 1, false, { hello: 'world' } ], { extra: true })
      const bar = Object.assign([ 1, true, { hello: 'world' } ], { extra: false })
      print(diff(foo, bar), [
        '[',
        '  1,',
        '  false ~ true,',
        '  {',
        '    "hello": "world",',
        '  },',
        '] … extra props … {',
        '  "extra": true ~ false,',
        '}',
      ])
    })

    it('should print the difference between two different maps with extra properties', () => {
      const foo = Object.assign(map({ foo: 123, bar: false, baz: { hello: 'world' } }), { extra: true })
      const bar = Object.assign(map({ foo: 123, bar: true, baz: { hello: 'world' } }), { extra: false })
      print(diff(foo, bar), [
        '[Map (3)] {',
        '  "foo" => 123,',
        '  "bar" => false ~ true,',
        '  "baz" => {',
        '    "hello": "world",',
        '  },',
        '} … extra props … {',
        '  "extra": true ~ false,',
        '}',
      ])
    })
  })

  /* ======================================================================== */

  describe('missing and extra diff', () => {
    it('should print the difference between two different objects', () => {
      print(diff(
          { foo: 123, bar: true, extra: { hello: 'planet' } },
          { foo: 123, baz: false, missing: { hello: 'world' } },
      ), [
        '{',
        '  "foo": 123,',
        '  (extra) "bar": true,',
        '  (extra) "extra": {',
        '    "hello": "planet",',
        '  },',
        '  (missing) "baz": false,',
        '  (missing) "missing": {',
        '    "hello": "world",',
        '  },',
        '}',
      ])
    })

    it('should print the difference between two different objects with an extra key mapped to undefined', () => {
      print(diff(
          { foo: 123, extra: undefined },
          { foo: 123 },
          true,
      ), [
        '{',
        '  "foo": 123,',
        '  (extra) "extra": <undefined>,',
        '}',
      ])
    })

    it('should print the difference between two different objects with a missing key mapped to undefined', () => {
      print(diff(
          { foo: 123 },
          { foo: 123, missing: undefined },
          true,
      ), [
        '{',
        '  "foo": 123,',
        '  (missing) "missing": <undefined>,',
        '}',
      ])
    })


    it('should print the difference between two different maps', () => {
      print(diff(
          map({ foo: 123, bar: true, extra: { hello: 'planet' } }),
          map({ foo: 123, baz: false, missing: { hello: 'world' } }),
      ), [
        '[Map (3)] {',
        '  "foo" => 123,',
        '  (extra) "bar" => true,',
        '  (extra) "extra" => {',
        '    "hello": "planet",',
        '  },',
        '  (missing) "baz" => false,',
        '  (missing) "missing" => {',
        '    "hello": "world",',
        '  },',
        '}',
      ])
    })

    it('should print the difference between two different sets', () => {
      print(diff(
          new Set([ 1, true, { hello: 'planet' }, 'foobar' ]),
          new Set([ 1, false, { hello: 'world' }, 'foobar' ]),
      ), [
        '[Set (4)] [',
        '  1,',
        '  "foobar",',
        '  (extra) true,',
        '  (extra) {',
        '    "hello": "planet",',
        '  },',
        '  (missing) false,',
        '  (missing) {',
        '    "hello": "world",',
        '  },',
        ']',
      ])
    })
  })

  /* ======================================================================== */

  describe('error diff', () => {
    it('should print a simple error difference', () => {
      print(diff([ true ], []), [
        '[',
        '  true,',
        '] (error) Expected [Array (1)] to have length 0 (length=1)',
      ])
    })

    it('should print an error difference within properties', () => {
      print(diff({ foo: new Set([ 'foo', 'bar' ]) }, { foo: new Map() }), [
        '{',
        '  "foo": [Map (0)] {} ~ [Set (2)] [',
        '    "foo",',
        '    "bar",',
        '  ], (error) Expected [Set (2)] to be instance of [Map]',
        '}',
      ])
    })

    it('should print an error difference within values', () => {
      print(diff([ new Set([ 'foo', 'bar' ]) ], [ new Map() ]), [
        '[',
        '  [Map (0)] {} ~ [Set (2)] [',
        '    "foo",',
        '    "bar",',
        '  ], (error) Expected [Set (2)] to be instance of [Map]',
        ']',
      ])
    })

    it('should print an error difference within mappings', () => {
      print(diff(map({ foo: new Set([ 'foo', 'bar' ]) }), map({ foo: new Map() })), [
        '[Map (1)] {',
        '  "foo" => [Map (0)] {} ~ [Set (2)] [',
        '    "foo",',
        '    "bar",',
        '  ], (error) Expected [Set (2)] to be instance of [Map]',
        '}',
      ])
    })
  })
})
