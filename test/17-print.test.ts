/* eslint-disable no-new-wrappers */
import { log } from '@plugjs/plug'

import { diff, type Diff } from '../src/expectation/diff'
import { printDiff } from '../src/expectation/print'

describe.only('Diff Printer', () => {
  function map(object: Record<string, any>): Map<any, any> {
    return new Map(Object.entries(object))
  }

  function print(diff: Diff): void {
    const logger = log.logger
    try {
      logger.enter()
      printDiff(logger, diff, false)
    } finally {
      logger.leave()
    }
  }

  /* ======================================================================== */

  describe('values dump', () => {
    it('should dump a primitive', () => {
      print({ diff: false, value: 123 })
    })

    it('should dump a simple object', () => {
      print({ diff: false, value: { foo: 'bar' } })
    })

    it('should dump an array', () => {
      print({ diff: false, value: [ 1, true, { foo: 'bar' } ] })
    })

    it('should dump a set', () => {
      print({ diff: false, value: new Set([ 1, true, { foo: 'bar' } ]) })
    })

    it('should dump a map', () => {
      print({ diff: false, value: map({ foo: 'bar', hello: [ 'world', 'planet' ], extra: true }) })
    })

    it('should dump a slightly more complex object', () => {
      print({ diff: false, value: { foo: 'bar', hello: [ 'world', 'planet' ], extra: true } })
    })

    it('should dump an array with extra properties', () => {
      const value = Object.assign([ 1, true, { foo: 'bar' } ], { extra: true })
      print({ diff: false, value })
    })

    it('should dump a set with extra properties', () => {
      const value = Object.assign(new Set([ 1, true, { foo: 'bar' } ]), { extra: true })
      print({ diff: false, value })
    })

    it('should dump a map with extra properties', () => {
      const value = Object.assign(map({ foo: 'bar', hello: [ 'world', 'planet' ] }), { extra: true })
      print({ diff: false, value })
    })

    it('should dump an empty object', () => {
      print({ diff: false, value: {} })
    })

    it('should dump an empty array', () => {
      print({ diff: false, value: [] })
    })

    it('should dump an empty array with extra properties', () => {
      print({ diff: false, value: Object.assign([], { extra: true }) })
    })

    it('should dump an empty set', () => {
      print({ diff: false, value: new Set([]) })
    })

    it('should dump an empty set with extra properties', () => {
      print({ diff: false, value: Object.assign(new Set([]), { extra: true }) })
    })

    it('should dump an empty map', () => {
      print({ diff: false, value: map({}) })
    })

    it('should dump an empty map with extra properies', () => {
      print({ diff: false, value: Object.assign(map({}), { extra: true }) })
    })

    it('should dump a test object', () => {
      const value = {
        string: 'foo',
        number: 12345,
        boolean: true,
        boxed: new String('bar'),
        boexd_with_propx: Object.assign(new String('baz'), { extra: true }),
        regexp: /abc/gi,
        regexp_with_propx: Object.assign(/abc/gi, { extra: true }),
        circular: { deep: {} },
      }
      value.circular.deep = value

      print({ diff: false, value })
    })
  })

  /* ======================================================================== */

  describe('no diff', () => {
    it('should print the difference between two equal primitives', () => {
      print(diff(123, 123))
    })

    it('should print the difference between two equal objects', () => {
      print(diff(
          { foo: 123, bar: true, baz: { hello: 'world' } },
          { foo: 123, bar: true, baz: { hello: 'world' } },
      ))
    })

    it('should print the difference between two equal arrays', () => {
      print(diff([ 1, true, { hello: 'world' } ], [ 1, true, { hello: 'world' } ]))
    })

    it('should print the difference between two equal maps', () => {
      print(diff(
          map({ foo: 123, bar: true, baz: { hello: 'world' } }),
          map({ foo: 123, bar: true, baz: { hello: 'world' } }),
      ))
    })

    it('should print the difference between two equal sets', () => {
      print(diff(new Set([ 1, true, { hello: 'world' } ]), new Set([ 1, true, { hello: 'world' } ])))
    })

    it('should print the difference between two empty objects', () => {
      print({ diff: false, type: '[Object]' }) // edge case, no
    })

    it('should print the difference between two equal arrays with extra properties', () => {
      const foo = Object.assign([ 1, true, { hello: 'world' } ], { extra: true })
      const bar = Object.assign([ 1, true, { hello: 'world' } ], { extra: true })
      print(diff(foo, bar))
    })

    it('should print the difference between two equal maps with extra properties', () => {
      const foo = Object.assign(map({ foo: 123, bar: true, baz: { hello: 'world' } }), { extra: true })
      const bar = Object.assign(map({ foo: 123, bar: true, baz: { hello: 'world' } }), { extra: true })
      print(diff(foo, bar))
    })
  })

  /* ======================================================================== */

  describe('value diff', () => {
    it('should print the difference between two different primitives', () => {
      print(diff(123, 321))
    })

    it('should print the difference between two different objects', () => {
      print(diff(
          { foo: 123, bar: true, baz: { hello: 'planet' } },
          { foo: 321, bar: false, baz: { hello: 'world' } },
      ))
    })

    it('should print the difference between two different arrays', () => {
      print(diff(
          [ 1, true, { hello: 'planet' } ],
          [ 1, false, { hello: 'world' } ],
      ))
    })

    it('should print the difference between two different maps', () => {
      print(diff(
          map({ foo: 123, bar: true, baz: { hello: 'planet' } }),
          map({ foo: 123, bar: false, baz: { hello: 'world' } }),
      ))
    })

    it('should print the difference between two different arrays with extra properties', () => {
      const foo = Object.assign([ 1, false, { hello: 'world' } ], { extra: true })
      const bar = Object.assign([ 1, true, { hello: 'world' } ], { extra: false })
      print(diff(foo, bar))
    })

    it('should print the difference between two different maps with extra properties', () => {
      const foo = Object.assign(map({ foo: 123, bar: false, baz: { hello: 'world' } }), { extra: true })
      const bar = Object.assign(map({ foo: 123, bar: true, baz: { hello: 'world' } }), { extra: false })
      print(diff(foo, bar))
    })
  })

  /* ======================================================================== */

  describe('missing and extra diff', () => {
    it('should print the difference between two different objects', () => {
      print(diff(
          { foo: 123, bar: true, extra: { hello: 'planet' } },
          { foo: 123, baz: false, missing: { hello: 'world' } },
      ))
    })

    it('should print the difference between two different maps', () => {
      print(diff(
          map({ foo: 123, bar: true, extra: { hello: 'planet' } }),
          map({ foo: 123, baz: false, missing: { hello: 'world' } }),
      ))
    })

    it('should print the difference between two different sets', () => {
      print(diff(
          new Set([ 1, 'foobar', true, { hello: 'planet' } ]),
          new Set([ 1, 'foobar', false, { hello: 'world' } ]),
      ))
    })
  })

  /* ======================================================================== */

  describe('error diff', () => {
    it('should print a simple error difference', () => {
      print(diff([], [ true ]))
    })

    it('should print an error difference within properties', () => {
      print(diff({ foo: new Set() }, { foo: new Map() }))
    })

    it('should print an error difference within values', () => {
      print(diff([ new Set() ], [ new Map() ]))
    })

    it('should print an error difference within mappings', () => {
      print(diff(map({ foo: new Set() }), map({ foo: new Map() })))
    })
  })
})
