import assert from 'node:assert'

import { diff } from '../src/expectation/diff'

/* eslint-disable no-new-wrappers */

describe('Differences', () => {
  it('should consider strictly equal values', () => {
    assert.deepEqual(diff('abc', 'abc'), {
      diff: false,
      actual: '"abc"',
    })

    const foo = {}
    assert.deepEqual(diff(foo, foo), {
      diff: false,
      actual: '<object>',
    })
  })

  it('should consider null values', () => {
    assert.deepEqual(diff(null, null), {
      diff: false,
      actual: '<null>',
    })

    assert.deepEqual(diff('foo', null), {
      diff: true,
      actual: '"foo"',
      expected: '<null>',
    })
  })

  it('should consider different value types', () => {
    assert.deepEqual(diff(123, 'foo'), {
      diff: true,
      actual: '123',
      expected: '"foo"',
    })

    assert.deepEqual(diff(new SyntaxError('Test'), false), {
      diff: true,
      actual: '[SyntaxError]',
      expected: 'false',
    })

    assert.deepEqual(diff(123n, 123), {
      diff: true,
      actual: '123n',
      expected: '123',
    })
  })

  it('should consider numbers (including NaN)', () => {
    assert.deepEqual(diff(123, 321), {
      diff: true,
      actual: '123',
      expected: '321',
    })

    assert.deepEqual(diff(NaN, 321), {
      diff: true,
      actual: 'NaN',
      expected: '321',
    })

    assert.deepEqual(diff(123, NaN), {
      diff: true,
      actual: '123',
      expected: 'NaN',
    })

    assert.deepEqual(diff(NaN, NaN), {
      diff: false,
      actual: 'NaN',
    })
  })

  it('should consider bigints', () => {
    assert.deepEqual(diff(123n, 321n), {
      diff: true,
      actual: '123n',
      expected: '321n',
    })
  })

  it('should consider booleans', () => {
    assert.deepEqual(diff(true, false), {
      diff: true,
      actual: 'true',
      expected: 'false',
    })
  })

  it('should consider functions', () => {
    const act = () => void 0
    const exp = () => void 0

    assert.deepEqual(diff(act, exp), {
      diff: true,
      actual: '<function act>',
      expected: '<function exp>',
    })

    assert.deepEqual(diff(act, () => void 0), {
      diff: true,
      actual: '<function act>',
      expected: '<function>',
    })

    assert.deepEqual(diff(() => void 0, exp), {
      diff: true,
      actual: '<function>',
      expected: '<function exp>',
    })
  })

  it('should consider strings', () => {
    assert.deepEqual(diff('foo', 'bar'), {
      diff: true,
      actual: '"foo"',
      expected: '"bar"',
    })

    assert.deepEqual(diff(
        'the quick brown dog jumped over the lazy fox',
        'the quick brown fox jumped over the lazy dog',
    ), {
      diff: true,
      actual: '"the quick brown dog jumped over the laz\u2026, length=44"',
      expected: '"the quick brown fox jumped over the laz\u2026, length=44"',
    })
  })

  it('should consider strings', () => {
    assert.deepEqual(diff('foo', 'bar'), {
      diff: true,
      actual: '"foo"',
      expected: '"bar"',
    })
  })

  it('should consider symbols', () => {
    assert.deepEqual(diff(Symbol(), Symbol()), {
      diff: true,
      actual: '<symbol>',
      expected: '<symbol>',
    })

    assert.deepEqual(diff(Symbol('a'), Symbol.for('b')), {
      diff: true,
      actual: '<symbol a>',
      expected: '<symbol b>',
    })

    assert.deepEqual(diff(Symbol.for('a'), Symbol.for('b')), {
      diff: true,
      actual: '<symbol a>',
      expected: '<symbol b>',
    })
  })

  it('should consider assignability', () => {
    assert.deepEqual(diff({}, new SyntaxError('foo')), {
      diff: true,
      actual: '<object>',
      error: 'to be instance of [SyntaxError]',
    })

    assert.deepEqual(diff(new TypeError('foo'), new SyntaxError('bar')), {
      diff: true,
      actual: '[TypeError]',
      error: 'to be instance of [SyntaxError]',
    })
  })

  describe('objects', () => {
    it('should diff two equal objects', () => {
      const act = { a: true, b: 123, c: 'foo' }
      const exp = { a: true, b: 123, c: 'foo' }

      assert.deepEqual(diff(act, exp), {
        diff: false,
        actual: '<object>',
        props: {
          a: {
            diff: false,
            actual: 'true',
          },
          b: {
            diff: false,
            actual: '123',
          },
          c: {
            diff: false,
            actual: '"foo"',
          },
        },
      })
    })

    it('should diff two objects with different properties', () => {
      const act = { a: true, b: 123, c: 'foo' }
      const exp = { a: null, b: 321, c: false }

      assert.deepEqual(diff(act, exp), {
        diff: true,
        actual: '<object>',
        props: {
          a: {
            diff: true,
            actual: 'true',
            expected: '<null>',
          },
          b: {
            diff: true,
            actual: '123',
            expected: '321',
          },
          c: {
            diff: true,
            actual: '"foo"',
            expected: 'false',
          },
        },
      })
    })

    it('should diff two objects with different prototypes', () => {
      const exp = Object.assign(Object.create(null), { a: true, b: 123, c: 'foo' })
      const act = { a: true, b: 123, c: 'foo' }

      assert.deepEqual(diff(act, exp), {
        diff: false,
        actual: '<object>',
        props: {
          a: {
            diff: false,
            actual: 'true',
          },
          b: {
            diff: false,
            actual: '123',
          },
          c: {
            diff: false,
            actual: '"foo"',
          },
        },
      })
    })

    it('should diff two objects from different classes', () => {
      class Exp {
        constructor(public foo: string) {}
      }
      class Act extends Exp {
        constructor(public foo: string) {
          super(foo)
        }
      }

      assert.deepEqual(diff(new Act('bar'), new Exp('bar')), {
        diff: false,
        actual: '[Act]',
        props: {
          foo: {
            diff: false,
            actual: '"bar"',
          },
        },
      })

      assert.deepEqual(diff(new Act('bar'), new Exp('baz')), {
        diff: true,
        actual: '[Act]',
        props: {
          foo: {
            diff: true,
            actual: '"bar"',
            expected: '"baz"',
          },
        },
      })
    })

    it('should consider non-enumerable properties', () => {
      const act = Object.defineProperty({}, 'foo', { value: 'bar' })
      const exp = Object.defineProperty({}, 'foo', { value: 'bar' })

      assert.deepEqual(diff(act, { foo: 'bar' }), {
        diff: false,
        actual: '<object>',
        props: {
          foo: {
            diff: false,
            actual: '"bar"',
          },
        },
      })

      assert.deepEqual(diff({ foo: 'bar' }, exp), {
        diff: false,
        actual: '<object>',
        props: {
          foo: {
            diff: false,
            actual: '"bar"',
          },
        },
      })

      assert.deepEqual(diff(act, exp), {
        diff: false,
        actual: '<object>',
      })
    })
  })

  describe('arrays', () => {
    it('should diff two equal arrays', () => {
      assert.deepEqual(diff([ 1, true, 'foo' ], [ 1, true, 'foo' ]), {
        diff: false,
        actual: '<array>',
        values: [
          { diff: false, actual: '1' },
          { diff: false, actual: 'true' },
          { diff: false, actual: '"foo"' },
        ],
      })
    })

    it('should diff two arrays with different contents', () => {
      assert.deepEqual(diff([ 1, true, 'foo' ], [ 2, false, 'bar' ]), {
        diff: true,
        actual: '<array>',
        values: [
          { diff: true, actual: '1', expected: '2' },
          { diff: true, actual: 'true', expected: 'false' },
          { diff: true, actual: '"foo"', expected: '"bar"' },
        ],
      })
    })

    it('should diff two arrays with extra properties', () => {
      const act = [ 1, true, 'foo' ]
      const exp = [ 1, true, 'foo' ]
      ;(act as any).foo = 'bar'
      ;(exp as any).foo = 'bar'

      assert.deepEqual(diff(act, exp), {
        diff: false,
        actual: '<array>',
        props: {
          foo: { diff: false, actual: '"bar"' },
        },
        values: [
          { diff: false, actual: '1' },
          { diff: false, actual: 'true' },
          { diff: false, actual: '"foo"' },
        ],
      })

      ;(act as any).foo = 'baz'
      assert.deepEqual(diff(act, exp), {
        diff: true,
        actual: '<array>',
        props: {
          foo: { diff: true, actual: '"baz"', expected: '"bar"' },
        },
        values: [
          { diff: false, actual: '1' },
          { diff: false, actual: 'true' },
          { diff: false, actual: '"foo"' },
        ],
      })
    })

    it('should diff two arrays with different lengths', () => {
      assert.deepEqual(diff([ true ], []), {
        diff: true,
        actual: '<array>',
        error: 'to have length 0 (length=1)',
      })
    })

    it('should fail when an array is not expected', () => {
      assert.deepEqual(diff([], {}), {
        diff: true,
        actual: '<array>',
        error: 'not to be an instance of <array>',
      })
    })
  })

  describe('boxed primitives', () => {
    it('should diff two equal boxed primitives', () => {
      assert.deepEqual(diff(new Boolean(true), new Boolean(true)), {
        diff: false,
        actual: '[Boolean: true]',
      })

      assert.deepEqual(diff(new Number(123), new Number(123)), {
        diff: false,
        actual: '[Number: 123]',
      })

      assert.deepEqual(diff(new String('foo'), new String('foo')), {
        diff: false,
        actual: '[String: "foo"]',
      })
    })

    it('should diff two differing boxed primitives', () => {
      assert.deepEqual(diff(new Boolean(true), new Boolean(false)), {
        diff: true,
        actual: '[Boolean: true]',
        expected: '[Boolean: false]',
      })

      assert.deepEqual(diff(new Number(123), new Number(321)), {
        diff: true,
        actual: '[Number: 123]',
        expected: '[Number: 321]',
      })

      assert.deepEqual(diff(new String('foo'), new String('bar')), {
        diff: true,
        actual: '[String: "foo"]',
        expected: '[String: "bar"]',
      })
    })

    it('should diff boxed primitives with extra properties', () => {
      const act1 = Object.assign(new String('hello'), { 'foo': 'bar' })
      const exp1 = Object.assign(new String('hello'), { 'foo': 'bar' })
      const exp2 = Object.assign(new String('hello'), { 'foo': 'baz' })

      assert.deepEqual(diff(act1, exp1), {
        diff: false,
        actual: '[String: "hello"]',
        props: {
          foo: { diff: false, actual: '"bar"' },
        },
      })

      assert.deepEqual(diff(act1, exp2), {
        diff: true,
        actual: '[String: "hello"]',
        props: {
          foo: {
            diff: true,
            actual: '"bar"',
            expected: '"baz"',
          },
        },
      })

      assert.deepEqual(diff(act1, new String('hello')), {
        diff: true,
        actual: '[String: "hello"]',
        props: {
          foo: {
            diff: true,
            actual: '"bar"',
            expected: '<undefined>',
          },
        },
      })

      assert.deepEqual(diff(new String('hello'), exp1), {
        diff: true,
        actual: '[String: "hello"]',
        props: {
          foo: {
            diff: true,
            actual: '<undefined>',
            expected: '"bar"',
          },
        },
      })
    })

    it('should fail when a boxed primitive is not expected', () => {
      assert.deepEqual(diff(new Boolean(true), {}), {
        diff: true,
        actual: '[Boolean: true]',
        error: 'not to be an instance of [Boolean]',
      })

      assert.deepEqual(diff(new Number(123), {}), {
        diff: true,
        actual: '[Number: 123]',
        error: 'not to be an instance of [Number]',
      })

      assert.deepEqual(diff(new String('foo'), {}), {
        diff: true,
        actual: '[String: "foo"]',
        error: 'not to be an instance of [String]',
      })
    })
  })

  describe('binary data', () => {
    it('should diff binaries with the same contents', () => {
      const act = Buffer.from('CAFEBABE', 'hex')
      const exp = Buffer.from('CAFEBABE', 'hex')

      assert.deepEqual(diff(act, exp), {
        diff: false,
        actual: '[Buffer]',
      })

      const uact = new Uint8Array(act)
      const uexp = new Uint8Array(exp)

      assert.deepEqual(diff(uact, uexp), {
        diff: false,
        actual: '[Uint8Array]',
      })

      const aact = uact.buffer
      const aexp = uexp.buffer

      assert.deepEqual(diff(aact, aexp), {
        diff: false,
        actual: '[ArrayBuffer]',
      })

      const sact = new SharedArrayBuffer(uact.byteLength)
      const sexp = new SharedArrayBuffer(uexp.byteLength)
      new Uint8Array(sact).set(uact)
      new Uint8Array(sexp).set(uexp)

      assert.deepEqual(diff(sact, sexp), {
        diff: false,
        actual: '[SharedArrayBuffer]',
      })
    })

    it('should diff binaries with different contents', () => {
      const act = Buffer.from('CAFEBABE', 'hex')
      const exp = Buffer.from('BABECAFE', 'hex')

      assert.deepEqual(diff(act, exp), {
        diff: true,
        actual: '[Buffer]',
        error: 'to equal at index 0 (actual=cafebabe, expected=babecafe)',
      })

      const uact = new Uint8Array(act)
      const uexp = new Uint8Array(exp)

      assert.deepEqual(diff(uact, uexp), {
        diff: true,
        actual: '[Uint8Array]',
        error: 'to equal at index 0 (actual=cafebabe, expected=babecafe)',
      })

      const aact = uact.buffer
      const aexp = uexp.buffer

      assert.deepEqual(diff(aact, aexp), {
        diff: true,
        actual: '[ArrayBuffer]',
        error: 'to equal at index 0 (actual=cafebabe, expected=babecafe)',
      })

      const sact = new SharedArrayBuffer(uact.byteLength)
      const sexp = new SharedArrayBuffer(uexp.byteLength)
      new Uint8Array(sact).set(uact)
      new Uint8Array(sexp).set(uexp)

      assert.deepEqual(diff(sact, sexp), {
        diff: true,
        actual: '[SharedArrayBuffer]',
        error: 'to equal at index 0 (actual=cafebabe, expected=babecafe)',
      })
    })

    it('should diff buffers with different lengths', () => {
      const act = Buffer.from('CAFEBABE', 'hex')
      const exp = Buffer.from('CAFE', 'hex')

      assert.deepEqual(diff(act, exp), {
        diff: true,
        actual: '[Buffer]',
        error: 'to have length 2 (length=4)',
      })

      const uact = new Uint8Array(act)
      const uexp = new Uint8Array(exp)

      assert.deepEqual(diff(uact, uexp), {
        diff: true,
        actual: '[Uint8Array]',
        error: 'to have length 2 (length=4)',
      })

      const aact = uact.buffer
      const aexp = uexp.buffer

      assert.deepEqual(diff(aact, aexp), {
        diff: true,
        actual: '[ArrayBuffer]',
        error: 'to have length 2 (length=4)',
      })

      const sact = new SharedArrayBuffer(uact.byteLength)
      const sexp = new SharedArrayBuffer(uexp.byteLength)
      new Uint8Array(sact).set(uact)
      new Uint8Array(sexp).set(uexp)

      assert.deepEqual(diff(sact, sexp), {
        diff: true,
        actual: '[SharedArrayBuffer]',
        error: 'to have length 2 (length=4)',
      })
    })

    it('should highlight differences for large buffers', () => {
      const act = Buffer.alloc(100, 'abcde')
      const exp = Buffer.alloc(100, 'ABCDE')
      act.fill(exp, 0, 50)

      assert.deepEqual(diff(act, exp), {
        diff: true,
        actual: '[Buffer]',
        error: 'to equal at index 50 (actual=\u20266162636465\u2026, expected=\u20264142434445\u2026)',
      })
    })

    it('should fail when a binary data is not expected', () => {
      const act = Buffer.from('CAFEBABE', 'hex')

      assert.deepEqual(diff(act, {}), {
        diff: true,
        actual: '[Buffer]',
        error: 'not to be an instance of [Buffer]',
      })

      const uact = new Uint8Array(act)

      assert.deepEqual(diff(uact, {}), {
        diff: true,
        actual: '[Uint8Array]',
        error: 'not to be an instance of [Uint8Array]',
      })

      const aact = uact.buffer

      assert.deepEqual(diff(aact, {}), {
        diff: true,
        actual: '[ArrayBuffer]',
        error: 'not to be an instance of [ArrayBuffer]',
      })

      const sact = new SharedArrayBuffer(uact.byteLength)
      new Uint8Array(sact).set(uact)

      assert.deepEqual(diff(sact, {}), {
        diff: true,
        actual: '[SharedArrayBuffer]',
        error: 'not to be an instance of [SharedArrayBuffer]',
      })
    })
  })

  describe('promises', () => {
    it('should diff with the same promise', () => {
      const promise = Promise.resolve()

      assert.deepEqual(diff(promise, promise), {
        diff: false,
        actual: '[Promise]',
      })
    })

    it('should diff with different promises', () => {
      const act = Promise.resolve()
      const exp = Promise.resolve()

      assert.deepEqual(diff(act, exp), {
        diff: true,
        actual: '[Promise]',
        error: 'to strictly equal [Promise]',
      })
    })

    it('should fail when a promise is not expected', () => {
      const promise = Promise.resolve()

      assert.deepEqual(diff(promise, {}), {
        diff: true,
        actual: '[Promise]',
        error: 'not to be an instance of [Promise]',
      })
    })
  })

  describe('regular expressions', () => {
    it('should diff with the same regular expression', () => {
      const act = /abc/gm
      const exp = /abc/gm

      assert.deepEqual(diff(act, exp), {
        diff: false,
        actual: '/abc/gm',
      })
    })

    it('should diff with different promises', () => {
      const act = /abc/gm
      const exp1 = /abc/g
      const exp2 = /ab/gm

      assert.deepEqual(diff(act, exp1), {
        diff: true,
        actual: '/abc/gm',
        expected: '/abc/g',
      })

      assert.deepEqual(diff(act, exp2), {
        diff: true,
        actual: '/abc/gm',
        expected: '/ab/gm',
      })
    })

    it('should fail when a regular expression is not expected', () => {
      const re = /abc/gm

      assert.deepEqual(diff(re, {}), {
        diff: true,
        actual: '/abc/gm',
        error: 'not to be an instance of [RegExp]',
      })
    })
  })

  describe('dates', () => {
    it('should diff with the same date', () => {
      const act = new Date()
      const exp = new Date(act.getTime())

      assert.deepEqual(diff(act, exp), {
        diff: false,
        actual: `[Date: ${act.toISOString()}]`,
      })
    })

    it('should diff with different dates', () => {
      const act = new Date(1681223640879)
      const exp = new Date(1681223640880)

      assert.deepEqual(diff(act, exp), {
        diff: true,
        actual: '[Date: 2023-04-11T14:34:00.879Z]',
        expected: '[Date: 2023-04-11T14:34:00.880Z]',
      })
    })

    it('should fail when a date is not expected', () => {
      const date = new Date(1681223640879)

      assert.deepEqual(diff(date, {}), {
        diff: true,
        actual: '[Date: 2023-04-11T14:34:00.879Z]',
        error: 'not to be an instance of [Date]',
      })
    })
  })

  describe('typed arrays', () => {
    const act = Buffer.alloc(16, 0xF1).buffer
    const exp = Buffer.alloc(16, 0xF1).buffer
    const not = Buffer.alloc(16, 0x00).buffer

    const data = [
      [ BigInt64Array, 2 ],
      [ BigUint64Array, 2 ],
      [ Float32Array, 4 ],
      [ Float64Array, 2 ],
      [ Int16Array, 8 ],
      [ Int32Array, 4 ],
      [ Int8Array, 16 ],
      [ Uint16Array, 8 ],
      [ Uint32Array, 4 ],
      [ Uint8ClampedArray, 16 ],
    ] as const

    describe('same data', () => {
      for (const [ Ctor, length ] of data) {
        it(`should diff ${Ctor.name} containing the same data`, () => {
          const aact = new Ctor(act)
          const aexp = new Ctor(exp)

          let actual = String(aexp[0])
          if (typeof aexp[0] === 'bigint') actual = actual + 'n'

          const values = new Array(length).fill({ diff: false, actual })

          assert.deepEqual(diff(aact, aexp), {
            diff: false,
            actual: `[${Ctor.name}]`,
            values,
          })
        })
      }
    })

    describe('different data', () => {
      for (const [ Ctor, length ] of data) {
        it(`should diff ${Ctor.name} containing different data`, () => {
          const aact = new Ctor(act)
          const aexp = new Ctor(not)

          let actString = String(aact[0])
          let expString = String(aexp[0])
          if (typeof aexp[0] === 'bigint') {
            actString = actString + 'n'
            expString = expString + 'n'
          }

          const values = new Array(length).fill({
            diff: true,
            actual: actString,
            expected: expString,
          })

          assert.deepEqual(diff(aact, aexp), {
            diff: true,
            actual: `[${Ctor.name}]`,
            values,
          })
        })
      }
    })

    describe('extra properties', () => {
      for (const [ Ctor, length ] of data) {
        it(`should diff ${Ctor.name} containing extra properties`, () => {
          const aact = new Ctor(act)
          const aexp = new Ctor(exp)
          Object.assign(aact, { foo: 'bar' })
          Object.assign(aexp, { foo: 'baz' })

          let actual = String(aexp[0])
          if (typeof aexp[0] === 'bigint') actual = actual + 'n'

          const values = new Array(length).fill({ diff: false, actual })

          assert.deepEqual(diff(aact, aexp), {
            diff: true,
            actual: `[${Ctor.name}]`,
            values,
            props: {
              foo: {
                diff: true,
                actual: '"bar"',
                expected: '"baz"',
              },
            },
          })
        })
      }
    })
  })

  describe('sets', () => {
    it('should diff sets with the same contents', () => {
      const act = new Set([ 1, true, 'foo', { hello: 'world' } ])
      const exp = new Set([ 1, true, 'foo', { hello: 'world' } ])

      assert.deepEqual(diff(act, exp), {
        diff: false,
        actual: '[Set]',
        values: [
          { diff: false, actual: '1' },
          { diff: false, actual: 'true' },
          { diff: false, actual: '"foo"' },
          {
            diff: false,
            actual: '<object>',
            props: {
              hello: {
                diff: false,
                actual: '"world"',
              },
            },
          },
        ],
      })
    })

    it('should diff sets with different contents', () => {
      const act = new Set([ 1, true, 'foo', { hello: 'world' } ])
      const exp = new Set([ 1, false, 'bar', [ 'one', 'two' ] ])

      assert.deepEqual(diff(act, exp), {
        diff: true,
        actual: '[Set]',
        values: [
          { diff: false, actual: '1' },
          { diff: true, actual: 'true', expected: '<undefined>' },
          { diff: true, actual: '"foo"', expected: '<undefined>' },
          { diff: true, actual: '<object>', expected: '<undefined>' },
          { diff: true, actual: '<undefined>', expected: 'false' },
          { diff: true, actual: '<undefined>', expected: '"bar"' },
          { diff: true, actual: '<undefined>', expected: '<array>' },
        ],
      })
    })

    it('should diff sets with different sizes', () => {
      assert.deepEqual(diff(new Set([ 'foo' ]), new Set()), {
        diff: true,
        actual: '[Set]',
        error: 'to have size 0 (size=1)',
      })

      assert.deepEqual(diff(new Set(), new Set([ 'foo' ])), {
        diff: true,
        actual: '[Set]',
        error: 'to have size 1 (size=0)',
      })
    })

    it('should diff sets with extra properties', () => {
      const act = Object.assign(new Set([ 1, true, 'foo', { hello: 'world' } ]), { foo: 'bar' })
      const exp = Object.assign(new Set([ 1, true, 'foo', { hello: 'world' } ]), { foo: 'baz' })

      assert.deepEqual(diff(act, exp), {
        diff: true,
        actual: '[Set]',
        props: {
          foo: {
            diff: true,
            actual: '"bar"',
            expected: '"baz"',
          },
        },
        values: [
          { diff: false, actual: '1' },
          { diff: false, actual: 'true' },
          { diff: false, actual: '"foo"' },
          {
            diff: false,
            actual: '<object>',
            props: {
              hello: {
                diff: false,
                actual: '"world"',
              },
            },
          },
        ],
      })
    })
  })

  describe('maps', () => {
    it('should diff maps with the same contents', () => {
      const key = { a: 'foo' }
      const act = new Map<any, any>([ [ key, 123 ], [ 'bar', true ] ])
      const exp = new Map<any, any>([ [ key, 123 ], [ 'bar', true ] ])

      assert.deepEqual(diff(act, exp), {
        diff: false,
        actual: '[Map]',
        mappings: [
          [ '<object>', { diff: false, actual: '123' } ],
          [ '"bar"', { diff: false, actual: 'true' } ],
        ],
      })
    })

    it('should diff maps with different contents', () => {
      const key = { a: 'foo' }
      const act = new Map<any, any>([ [ key, 123 ], [ 'foo', 'baz' ], [ 'bar', true ] ])
      const exp = new Map<any, any>([ [ key, 321 ], [ 'baz', 'foo' ], [ 'bar', false ] ])

      assert.deepEqual(diff(act, exp), {
        diff: true,
        actual: '[Map]',
        mappings: [
          [ '<object>', { diff: true, actual: '123', expected: '321' } ],
          [ '"foo"', { diff: true, actual: '"baz"', expected: '<undefined>' } ],
          [ '"bar"', { diff: true, actual: 'true', expected: 'false' } ],
          [ '"baz"', { diff: true, actual: '<undefined>', expected: '"foo"' } ],
        ],
      })
    })

    it('should diff maps with different sizes', () => {
      assert.deepEqual(diff(new Map([ [ 'foo', 'bar' ] ]), new Map()), {
        diff: true,
        actual: '[Map]',
        error: 'to have size 0 (size=1)',
      })

      assert.deepEqual(diff(new Map(), new Map([ [ 'foo', 'bar' ] ])), {
        diff: true,
        actual: '[Map]',
        error: 'to have size 1 (size=0)',
      })
    })

    it('should diff maps with extra properties', () => {
      const key = { a: 'foo' }
      const act = Object.assign(new Map<any, any>([ [ key, 123 ], [ 'bar', true ] ]), { hello: 'world' })
      const exp = Object.assign(new Map<any, any>([ [ key, 123 ], [ 'bar', true ] ]), { hello: 'planet' })

      assert.deepEqual(diff(act, exp), {
        diff: true,
        actual: '[Map]',
        props: {
          hello: {
            diff: true,
            actual: '"world"',
            expected: '"planet"',
          },
        },
        mappings: [
          [ '<object>', { diff: false, actual: '123' } ],
          [ '"bar"', { diff: false, actual: 'true' } ],
        ],
      })
    })
  })
})
