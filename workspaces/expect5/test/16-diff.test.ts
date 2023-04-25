import { deepEqual } from 'node:assert'

import { diff } from '../src/expectation/diff'

/* eslint-disable no-new-wrappers */

describe('Differences', () => {
  it('should consider strictly equal values', () => {
    deepEqual(diff('abc', 'abc'), {
      diff: false,
      value: 'abc',
    })

    const foo = {}
    deepEqual(diff(foo, foo), {
      diff: false,
      value: foo,
    })
  })

  it('should consider null values', () => {
    deepEqual(diff(null, null), {
      diff: false,
      value: null,
    })

    deepEqual(diff('foo', null), {
      diff: true,
      value: 'foo',
      expected: null,
    })
  })

  it('should consider different value types', () => {
    deepEqual(diff(123, 'foo'), {
      diff: true,
      value: 123,
      expected: 'foo',
    })

    const e = new SyntaxError('Test')
    deepEqual(diff(e, false), {
      diff: true,
      value: e,
      expected: false,
    })

    deepEqual(diff(123n, 123), {
      diff: true,
      value: 123n,
      expected: 123,
    })
  })

  it('should consider numbers (including NaN)', () => {
    deepEqual(diff(123, 321), {
      diff: true,
      value: 123,
      expected: 321,
    })

    deepEqual(diff(NaN, 321), {
      diff: true,
      value: NaN,
      expected: 321,
    })

    deepEqual(diff(123, NaN), {
      diff: true,
      value: 123,
      expected: NaN,
    })

    deepEqual(diff(NaN, NaN), {
      diff: false,
      value: NaN,
    })
  })

  it('should consider bigints', () => {
    deepEqual(diff(123n, 321n), {
      diff: true,
      value: 123n,
      expected: 321n,
    })
  })

  it('should consider booleans', () => {
    deepEqual(diff(true, false), {
      diff: true,
      value: true,
      expected: false,
    })
  })

  it('should consider functions', () => {
    const act = () => void 0
    const exp = () => void 0

    deepEqual(diff(act, exp), {
      diff: true,
      value: act,
      expected: exp,
    })
  })

  it('should consider strings', () => {
    deepEqual(diff('foo', 'bar'), {
      diff: true,
      value: 'foo',
      expected: 'bar',
    })
  })

  it('should consider symbols', () => {
    const s1 = Symbol()
    const s2 = Symbol()
    const sa = Symbol('a')
    const sb = Symbol('b')
    const sfa = Symbol.for('a')
    const sfb = Symbol.for('b')
    const sf = Symbol.for('a') // same as for "a"

    deepEqual(diff(s1, s2), { diff: true, value: s1, expected: s2 })
    deepEqual(diff(sa, sb), { diff: true, value: sa, expected: sb })
    deepEqual(diff(sfa, sfb), { diff: true, value: sfa, expected: sfb })
    deepEqual(diff(sa, sfa), { diff: true, value: sa, expected: sfa })
    deepEqual(diff(sfb, sb), { diff: true, value: sfb, expected: sb })
    deepEqual(diff(sfa, sf), { diff: false, value: sfa })
    deepEqual(diff(sf, sfa), { diff: false, value: sfa })
  })

  it('should consider assignability', () => {
    const a = new SyntaxError('foo')
    deepEqual(diff({}, a), {
      diff: true,
      value: {},
      error: 'Expected [Object] to be instance of [SyntaxError]',
      expected: a,
    })

    const b = new TypeError('foo')
    deepEqual(diff(a, b), {
      diff: true,
      value: a,
      error: 'Expected [SyntaxError] to be instance of [TypeError]',
      expected: b,
    })
  })

  describe('objects', () => {
    it('should diff two equal objects', () => {
      const act = { a: true, b: 123, c: 'foo' }
      const exp = { a: true, b: 123, c: 'foo' }

      deepEqual(diff(act, exp), {
        diff: false,
        value: act,
        props: {
          a: {
            diff: false,
            value: true,
          },
          b: {
            diff: false,
            value: 123,
          },
          c: {
            diff: false,
            value: 'foo',
          },
        },
      })
    })

    it('should diff two equal cyclical objects', () => {
      const act = { a: true, b: 123, c: 'foo', cycle: {} }
      const exp = { a: true, b: 123, c: 'foo', cycle: {} }
      act.cycle = act
      exp.cycle = exp

      deepEqual(diff(act, exp), {
        diff: false,
        value: act,
        props: {
          a: {
            diff: false,
            value: true,
          },
          b: {
            diff: false,
            value: 123,
          },
          c: {
            diff: false,
            value: 'foo',
          },
          cycle: {
            diff: false,
            value: act,
          },
        },
      })
    })

    it('should diff two objects with different property values', () => {
      const act = { a: true, b: 123, c: 'foo' }
      const exp = { a: null, b: 321, c: false }

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        props: {
          a: {
            diff: true,
            value: true,
            expected: null,
          },
          b: {
            diff: true,
            value: 123,
            expected: 321,
          },
          c: {
            diff: true,
            value: 'foo',
            expected: false,
          },
        },
      })
    })

    it('should diff two objects with different properties', () => {
      const act = { a: true, b: 123, c: 'foo' }
      const exp = { a: null, b: 321, d: false }

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        props: {
          a: {
            diff: true,
            value: true,
            expected: null,
          },
          b: {
            diff: true,
            value: 123,
            expected: 321,
          },
          c: {
            diff: true,
            extra: 'foo',
          },
          d: {
            diff: true,
            missing: false,
          },
        },
      })
    })

    it('should diff two objects with an extra key with undefined value', () => {
      const act = { a: true, b: 123, c: undefined }
      const exp = { a: true, b: 123 }

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        props: {
          a: {
            diff: false,
            value: true,
          },
          b: {
            diff: false,
            value: 123,
          },
          c: {
            diff: true,
            extra: undefined,
          },
        },
      })
    })

    it('should diff two objects with a missing key with undefined value', () => {
      const act = { a: true, b: 123 }
      const exp = { a: true, b: 123, c: undefined }

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        props: {
          a: {
            diff: false,
            value: true,
          },
          b: {
            diff: false,
            value: 123,
          },
          c: {
            diff: true,
            missing: undefined,
          },
        },
      })
    })

    it('should diff two cyclical objects with different properties', () => {
      const act = { a: true, b: 123, c: 'foo', cycle: {} }
      const exp = { a: null, b: 321, c: false, cycle: {} }
      act.cycle = act
      exp.cycle = exp

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        props: {
          a: {
            diff: true,
            value: true,
            expected: null,
          },
          b: {
            diff: true,
            value: 123,
            expected: 321,
          },
          c: {
            diff: true,
            value: 'foo',
            expected: false,
          },
          cycle: {
            diff: false,
            value: act,
          },
        },
      })
    })

    it('should diff two cyclical objects with different cyclical properties', () => {
      const act = { a: true, b: 123, c: 'foo', cycle_act: {} }
      const exp = { a: null, b: 321, c: false, cycle_exp: {} }
      act.cycle_act = act
      exp.cycle_exp = exp

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        props: {
          a: {
            diff: true,
            value: true,
            expected: null,
          },
          b: {
            diff: true,
            value: 123,
            expected: 321,
          },
          c: {
            diff: true,
            value: 'foo',
            expected: false,
          },
          cycle_act: {
            diff: true,
            extra: act,
          },
          cycle_exp: {
            diff: true,
            missing: exp,
          },
        },
      })
    })

    it('should diff two objects with different prototypes', () => {
      const exp = Object.assign(Object.create(null), { a: true, b: 123, c: 'foo' })
      const act = { a: true, b: 123, c: 'foo' }

      deepEqual(diff(act, exp), {
        diff: false,
        value: act,
        props: {
          a: {
            diff: false,
            value: true,
          },
          b: {
            diff: false,
            value: 123,
          },
          c: {
            diff: false,
            value: 'foo',
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

      const act = new Act('bar')
      deepEqual(diff(act, new Exp('bar')), {
        diff: false,
        value: act,
        props: {
          foo: {
            diff: false,
            value: 'bar',
          },
        },
      })

      deepEqual(diff(act, new Exp('baz')), {
        diff: true,
        value: act,
        props: {
          foo: {
            diff: true,
            value: 'bar',
            expected: 'baz',
          },
        },
      })
    })

    it('should consider non-enumerable properties', () => {
      const act = Object.defineProperty({}, 'foo', { value: 'bar' })
      const exp = Object.defineProperty({}, 'foo', { value: 'bar' })

      deepEqual(diff(act, { foo: 'bar' }), {
        diff: false,
        value: act,
        props: {
          foo: {
            diff: false,
            value: 'bar',
          },
        },
      })

      deepEqual(diff({ foo: 'bar' }, exp), {
        diff: false,
        value: { foo: 'bar' },
        props: {
          foo: {
            diff: false,
            value: 'bar',
          },
        },
      })

      deepEqual(diff(act, exp), {
        diff: false,
        value: act,
      })
    })
  })

  describe('arrays', () => {
    it('should diff two equal arrays', () => {
      deepEqual(diff([ 1, true, 'foo' ], [ 1, true, 'foo' ]), {
        diff: false,
        value: [ 1, true, 'foo' ],
        values: [
          { diff: false, value: '1' },
          { diff: false, value: true },
          { diff: false, value: 'foo' },
        ],
      })
    })

    it('should diff two arrays with different contents', () => {
      deepEqual(diff([ 1, true, 'foo' ], [ 2, false, 'bar' ]), {
        diff: true,
        value: [ 1, true, 'foo' ],
        values: [
          { diff: true, value: 1, expected: 2 },
          { diff: true, value: true, expected: false },
          { diff: true, value: 'foo', expected: 'bar' },
        ],
      })
    })

    it('should diff two arrays with extra properties', () => {
      const act = Object.assign([ 1, true, 'foo' ], { foo: 'bar' })
      const exp = Object.assign([ 1, true, 'foo' ], { foo: 'bar' })

      deepEqual(diff(act, exp), {
        diff: false,
        value: act,
        props: {
          foo: { diff: false, value: 'bar' },
        },
        values: [
          { diff: false, value: 1 },
          { diff: false, value: true },
          { diff: false, value: 'foo' },
        ],
      })

      act.foo = 'baz'
      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        props: {
          foo: { diff: true, value: 'baz', expected: 'bar' },
        },
        values: [
          { diff: false, value: 1 },
          { diff: false, value: true },
          { diff: false, value: 'foo' },
        ],
      })
    })

    it('should diff two arrays with different lengths', () => {
      deepEqual(diff([ true ], []), {
        diff: true,
        value: [ true ],
        error: 'Expected [Array (1)] to have length 0 (length=1)',
      })
    })

    it('should fail when an array is not expected', () => {
      deepEqual(diff([], {}), {
        diff: true,
        value: [],
        expected: {},
      })
    })
  })

  describe('boxed primitives', () => {
    it('should diff two equal boxed primitives', () => {
      deepEqual(diff(new Boolean(true), new Boolean(true)), {
        diff: false,
        value: new Boolean(true),
      })

      deepEqual(diff(new Number(123), new Number(123)), {
        diff: false,
        value: new Number(123),
      })

      deepEqual(diff(new String('foo'), new String('foo')), {
        diff: false,
        value: new String('foo'),
      })
    })

    it('should diff two differing boxed primitives', () => {
      deepEqual(diff(new Boolean(true), new Boolean(false)), {
        diff: true,
        value: new Boolean(true),
        expected: new Boolean(false),
      })

      deepEqual(diff(new Number(123), new Number(321)), {
        diff: true,
        value: new Number(123),
        expected: new Number(321),
      })

      deepEqual(diff(new String('foo'), new String('bar')), {
        diff: true,
        value: new String('foo'),
        expected: new String('bar'),
      })
    })

    it('should diff boxed primitives with extra properties', () => {
      const act1 = Object.assign(new String('hello'), { 'foo': 'bar' })
      const exp1 = Object.assign(new String('hello'), { 'foo': 'bar' })
      const exp2 = Object.assign(new String('hello'), { 'foo': 'baz' })

      deepEqual(diff(act1, exp1), {
        diff: false,
        value: act1,
        props: {
          foo: { diff: false, value: 'bar' },
        },
      })

      deepEqual(diff(act1, exp2), {
        diff: true,
        value: act1,
        props: {
          foo: {
            diff: true,
            value: 'bar',
            expected: 'baz',
          },
        },
      })

      deepEqual(diff(act1, new String('hello')), {
        diff: true,
        value: act1,
        props: {
          foo: {
            diff: true,
            extra: 'bar',
          },
        },
      })

      deepEqual(diff(new String('hello'), exp1), {
        diff: true,
        value: new String('hello'),
        props: {
          foo: {
            diff: true,
            missing: 'bar',
          },
        },
      })
    })

    it('should fail when a boxed primitive is not expected', () => {
      deepEqual(diff(new Boolean(true), {}), {
        diff: true,
        value: new Boolean(true),
        expected: {},
      })

      deepEqual(diff(new Number(123), {}), {
        diff: true,
        value: new Number(123),
        expected: {},
      })

      deepEqual(diff(new String('foo'), {}), {
        diff: true,
        value: new String('foo'),
        expected: {},
      })
    })
  })

  describe('binary data', () => {
    it('should diff binaries with the same contents', () => {
      const act = Buffer.from('CAFEBABE', 'hex')
      const exp = Buffer.from('CAFEBABE', 'hex')

      deepEqual(diff(act, exp), {
        diff: false,
        value: act,
      })

      const uact = new Uint8Array(act)
      const uexp = new Uint8Array(exp)

      deepEqual(diff(uact, uexp), {
        diff: false,
        value: uact,
      })

      const aact = uact.buffer
      const aexp = uexp.buffer

      deepEqual(diff(aact, aexp), {
        diff: false,
        value: aact,
      })

      const sact = new SharedArrayBuffer(uact.byteLength)
      const sexp = new SharedArrayBuffer(uexp.byteLength)
      new Uint8Array(sact).set(uact)
      new Uint8Array(sexp).set(uexp)

      deepEqual(diff(sact, sexp), {
        diff: false,
        value: sact,
      })
    })

    it('should diff binaries with different contents', () => {
      const act = Buffer.from('CAFEBABE', 'hex')
      const exp = Buffer.from('BABECAFE', 'hex')

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        error: 'Expected [Buffer: cafebabe] to equal at index 0 (actual=cafebabe, expected=babecafe)',
      })

      const uact = new Uint8Array(act)
      const uexp = new Uint8Array(exp)

      deepEqual(diff(uact, uexp), {
        diff: true,
        value: uact,
        error: 'Expected [Uint8Array: cafebabe] to equal at index 0 (actual=cafebabe, expected=babecafe)',
      })

      const aact = uact.buffer
      const aexp = uexp.buffer

      deepEqual(diff(aact, aexp), {
        diff: true,
        value: aact,
        error: 'Expected [ArrayBuffer: cafebabe] to equal at index 0 (actual=cafebabe, expected=babecafe)',
      })

      const sact = new SharedArrayBuffer(uact.byteLength)
      const sexp = new SharedArrayBuffer(uexp.byteLength)
      new Uint8Array(sact).set(uact)
      new Uint8Array(sexp).set(uexp)

      deepEqual(diff(sact, sexp), {
        diff: true,
        value: sact,
        error: 'Expected [SharedArrayBuffer: cafebabe] to equal at index 0 (actual=cafebabe, expected=babecafe)',
      })
    })

    it('should diff buffers with different lengths', () => {
      const act = Buffer.from('CAFEBABE', 'hex')
      const exp = Buffer.from('CAFE', 'hex')

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        error: 'Expected [Buffer: cafebabe] to have length 2 (length=4)',
      })

      const uact = new Uint8Array(act)
      const uexp = new Uint8Array(exp)

      deepEqual(diff(uact, uexp), {
        diff: true,
        value: uact,
        error: 'Expected [Uint8Array: cafebabe] to have length 2 (length=4)',
      })

      const aact = uact.buffer
      const aexp = uexp.buffer

      deepEqual(diff(aact, aexp), {
        diff: true,
        value: aact,
        error: 'Expected [ArrayBuffer: cafebabe] to have length 2 (length=4)',
      })

      const sact = new SharedArrayBuffer(uact.byteLength)
      const sexp = new SharedArrayBuffer(uexp.byteLength)
      new Uint8Array(sact).set(uact)
      new Uint8Array(sexp).set(uexp)

      deepEqual(diff(sact, sexp), {
        diff: true,
        value: sact,
        error: 'Expected [SharedArrayBuffer: cafebabe] to have length 2 (length=4)',
      })
    })

    it('should highlight differences for large buffers', () => {
      const act = Buffer.alloc(100, 'abcde')
      const exp = Buffer.alloc(100, 'ABCDE')
      act.fill(exp, 0, 50)

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        error: 'Expected [Buffer: 4142434445414243444541424344454142434445…, length=100] to equal at index 50 (actual=…6162636465…, expected=…4142434445…)',
      })
    })

    it('should fail when a binary data is not expected', () => {
      const act = Buffer.from('CAFEBABE', 'hex')

      deepEqual(diff(act, {}), {
        diff: true,
        value: act,
        expected: {},
      })

      const uact = new Uint8Array(act)

      deepEqual(diff(uact, {}), {
        diff: true,
        value: uact,
        expected: {},
      })

      const aact = uact.buffer

      deepEqual(diff(aact, {}), {
        diff: true,
        value: aact,
        expected: {},
      })

      const sact = new SharedArrayBuffer(uact.byteLength)
      new Uint8Array(sact).set(uact)

      deepEqual(diff(sact, {}), {
        diff: true,
        value: sact,
        expected: {},
      })
    })
  })

  describe('promises', () => {
    it('should diff with the same promise', () => {
      const promise = Promise.resolve()

      deepEqual(diff(promise, promise), {
        diff: false,
        value: promise,
      })
    })

    it('should diff with different promises', () => {
      const act = Promise.resolve()
      const exp = Promise.resolve()
      exp.catch(() => {}) // avoid uncaught exceptions

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        error: 'Expected [Promise] to strictly equal [Promise]',
      })
    })

    it('should fail when a promise is not expected', () => {
      const promise = Promise.resolve()

      deepEqual(diff(promise, {}), {
        diff: true,
        value: promise,
        expected: {},
      })
    })
  })

  describe('regular expressions', () => {
    it('should diff with the same regular expression', () => {
      const act = /abc/gm
      const exp = /abc/gm

      deepEqual(diff(act, exp), {
        diff: false,
        value: act,
      })
    })

    it('should diff with different promises', () => {
      const act = /abc/gm
      const exp1 = /abc/g
      const exp2 = /ab/gm

      deepEqual(diff(act, exp1), {
        diff: true,
        value: act,
        expected: exp1,
      })

      deepEqual(diff(act, exp2), {
        diff: true,
        value: act,
        expected: exp2,
      })
    })

    it('should fail when a regular expression is not expected', () => {
      const re = /abc/gm

      deepEqual(diff(re, {}), {
        diff: true,
        value: re,
        expected: {},
      })
    })
  })

  describe('dates', () => {
    it('should diff with the same date', () => {
      const act = new Date()
      const exp = new Date(act.getTime())

      deepEqual(diff(act, exp), {
        diff: false,
        value: act,
      })
    })

    it('should diff with different dates', () => {
      const act = new Date(1681223640879)
      const exp = new Date(1681223640880)

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        expected: exp,
      })
    })

    it('should fail when a date is not expected', () => {
      const date = new Date(1681223640879)

      deepEqual(diff(date, {}), {
        diff: true,
        value: date,
        expected: {},
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

          const values = new Array(length).fill({ diff: false, value: aexp[0] })

          deepEqual(diff(aact, aexp), {
            diff: false,
            value: aact,
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

          const values = new Array(length).fill({
            diff: true,
            value: aact[0],
            expected: aexp[0],
          })

          deepEqual(diff(aact, aexp), {
            diff: true,
            value: aact,
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

          const values = new Array(length).fill({ diff: false, value: aexp[0] })

          deepEqual(diff(aact, aexp), {
            diff: true,
            value: aact,
            values,
            props: {
              foo: {
                diff: true,
                value: 'bar',
                expected: 'baz',
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

      deepEqual(diff(act, exp), {
        diff: false,
        value: act,
        values: [
          { diff: false, value: 1 },
          { diff: false, value: true },
          { diff: false, value: 'foo' },
          {
            diff: false,
            value: { hello: 'world' },
            props: {
              hello: {
                diff: false,
                value: 'world',
              },
            },
          },
        ],
      })
    })

    it('should diff sets with different contents', () => {
      const act = new Set([ 1, true, 'foo', { hello: 'world' } ])
      const exp = new Set([ 1, false, 'bar', [ 'one', 'two' ] ])

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        values: [
          { diff: false, value: 1 },
          { diff: true, extra: true },
          { diff: true, extra: 'foo' },
          { diff: true, extra: { hello: 'world' } },
          { diff: true, missing: false },
          { diff: true, missing: 'bar' },
          { diff: true, missing: [ 'one', 'two' ] },
        ],
      })
    })

    it('should diff sets with different sizes', () => {
      const set0 = new Set()
      const set1 = new Set([ 'foo' ])

      deepEqual(diff(set1, set0), {
        diff: true,
        value: set1,
        error: 'Expected [Set (1)] to have size 0 (size=1)',
        values: [ { diff: true, extra: 'foo' } ],
      })

      deepEqual(diff(set0, set1), {
        diff: true,
        value: set0,
        error: 'Expected [Set (0)] to have size 1 (size=0)',
        values: [ { diff: true, missing: 'foo' } ],
      })
    })

    it('should diff sets with extra properties', () => {
      const act = Object.assign(new Set([ 1, true, 'foo', { hello: 'world' } ]), { foo: 'bar' })
      const exp = Object.assign(new Set([ 1, true, 'foo', { hello: 'world' } ]), { foo: 'baz' })

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        props: {
          foo: {
            diff: true,
            value: 'bar',
            expected: 'baz',
          },
        },
        values: [
          { diff: false, value: 1 },
          { diff: false, value: true },
          { diff: false, value: 'foo' },
          {
            diff: false,
            value: { hello: 'world' },
            props: {
              hello: {
                diff: false,
                value: 'world',
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

      deepEqual(diff(act, exp), {
        diff: false,
        value: act,
        mappings: [
          [ key, { diff: false, value: 123 } ],
          [ 'bar', { diff: false, value: true } ],
        ],
      })
    })

    it('should diff maps with different contents', () => {
      const key = { a: 'foo' }
      const act = new Map<any, any>([ [ key, 123 ], [ 'foo', 'baz' ], [ 'bar', true ] ])
      const exp = new Map<any, any>([ [ key, 321 ], [ 'baz', 'foo' ], [ 'bar', false ] ])

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        mappings: [
          [ key, { diff: true, value: 123, expected: 321 } ],
          [ 'foo', { diff: true, extra: 'baz' } ],
          [ 'bar', { diff: true, value: true, expected: false } ],
          [ 'baz', { diff: true, missing: 'foo' } ],
        ],
      })
    })

    it('should diff maps with different sizes', () => {
      const map0 = new Map()
      const map1 = new Map([ [ 'foo', 'bar' ] ])

      deepEqual(diff(map1, map0), {
        diff: true,
        value: map1,
        mappings: [
          [ 'foo', { diff: true, extra: 'bar' } ],
        ],
      })

      deepEqual(diff(map0, map1), {
        diff: true,
        value: map0,
        mappings: [
          [ 'foo', { diff: true, missing: 'bar' } ],
        ],
      })
    })

    it('should diff maps with extra properties', () => {
      const key = { a: 'foo' }
      const act = Object.assign(new Map<any, any>([ [ key, 123 ], [ 'bar', true ] ]), { hello: 'world' })
      const exp = Object.assign(new Map<any, any>([ [ key, 123 ], [ 'bar', true ] ]), { hello: 'planet' })

      deepEqual(diff(act, exp), {
        diff: true,
        value: act,
        props: {
          hello: { diff: true, value: 'world', expected: 'planet' },
        },
        mappings: [
          [ key, { diff: false, value: 123 } ],
          [ 'bar', { diff: false, value: true } ],
        ],
      })
    })
  })
})
