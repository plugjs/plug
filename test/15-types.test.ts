import assert from 'node:assert'

import { assertType, isType, prefixType, stringifyConstructor, stringifyValue, typeOf } from '../src/expectation/types'
import { expectPass, expectFail } from './utils'

/* eslint-disable no-new-wrappers */

describe('Type Utilities', () => {
  it('should correctly return the extended type of a value', () => {
    assert.strictEqual(typeOf(null), 'null')

    assert.strictEqual(typeOf(123n), 'bigint')
    assert.strictEqual(typeOf(true), 'boolean')
    assert.strictEqual(typeOf(() => {}), 'function')
    assert.strictEqual(typeOf(12345678), 'number')
    assert.strictEqual(typeOf('foobar'), 'string')
    assert.strictEqual(typeOf(Symbol()), 'symbol')
    assert.strictEqual(typeOf(undefined), 'undefined')

    assert.strictEqual(typeOf([]), 'array')
    assert.strictEqual(typeOf(Promise.resolve()), 'promise')
    assert.strictEqual(typeOf({ then: () => {} }), 'promise')
    assert.strictEqual(typeOf(Buffer.from('x')), 'buffer')
    assert.strictEqual(typeOf(/abc/), 'regexp')
    assert.strictEqual(typeOf(new Map()), 'map')
    assert.strictEqual(typeOf(new Set()), 'set')

    assert.strictEqual(typeOf({}), 'object')
    assert.strictEqual(typeOf(new class {}), 'object')
    assert.strictEqual(typeOf(new class Foo {}), 'object')
  })

  it('should correctly guard for the type of a value', () => {
    assert.strictEqual(isType({ value: null } as any, 'null'), true)
    assert.strictEqual(isType({ value: 123n } as any, 'bigint'), true)
    assert.strictEqual(isType({ value: true } as any, 'boolean'), true)
    assert.strictEqual(isType({ value: () => {} } as any, 'function'), true)
    assert.strictEqual(isType({ value: 12345678 } as any, 'number'), true)
    assert.strictEqual(isType({ value: 'foobar' } as any, 'string'), true)
    assert.strictEqual(isType({ value: Symbol() } as any, 'symbol'), true)
    assert.strictEqual(isType({ value: undefined } as any, 'undefined'), true)
    assert.strictEqual(isType({ value: [] } as any, 'array'), true)
    assert.strictEqual(isType({ value: Promise.resolve() } as any, 'promise'), true)
    assert.strictEqual(isType({ value: { then: () => {} } } as any, 'promise'), true)
    assert.strictEqual(isType({ value: Buffer.from('x') } as any, 'buffer'), true)
    assert.strictEqual(isType({ value: /abc/ } as any, 'regexp'), true)
    assert.strictEqual(isType({ value: new Map() } as any, 'map'), true)
    assert.strictEqual(isType({ value: new Set() } as any, 'set'), true)
    assert.strictEqual(isType({ value: {} } as any, 'object'), true)
    assert.strictEqual(isType({ value: new class {} } as any, 'object'), true)
    assert.strictEqual(isType({ value: new class Foo {} } as any, 'object'), true)

    assert.strictEqual(isType({ value: null } as any, 'object'), false)
    assert.strictEqual(isType({ value: 123n } as any, 'null'), false)
    assert.strictEqual(isType({ value: true } as any, 'bigint'), false)
    assert.strictEqual(isType({ value: () => {} } as any, 'boolean'), false)
    assert.strictEqual(isType({ value: 12345678 } as any, 'function'), false)
    assert.strictEqual(isType({ value: 'foobar' } as any, 'number'), false)
    assert.strictEqual(isType({ value: Symbol() } as any, 'string'), false)
    assert.strictEqual(isType({ value: undefined } as any, 'symbol'), false)
    assert.strictEqual(isType({ value: [] } as any, 'undefined'), false)
    assert.strictEqual(isType({ value: Promise.resolve() } as any, 'array'), false)
    assert.strictEqual(isType({ value: { then: () => {} } } as any, 'array'), false)
    assert.strictEqual(isType({ value: Buffer.from('x') } as any, 'promise'), false)
    assert.strictEqual(isType({ value: /abc/ } as any, 'buffer'), false)
    assert.strictEqual(isType({ value: new Map() } as any, 'regexp'), false)
    assert.strictEqual(isType({ value: new Set() } as any, 'map'), false)
    assert.strictEqual(isType({ value: {} } as any, 'set'), false)
    assert.strictEqual(isType({ value: new class {} } as any, 'set'), false)
    assert.strictEqual(isType({ value: new class Foo {} } as any, 'set'), false)
  })

  it('should correctly assert the type of a value', () => {
    expectPass(() => assertType({ value: null } as any, 'null'))
    expectFail(() => assertType({ value: null } as any, 'object'), 'Expected <null> to be an <object>')
  })

  it('should stringify a constructor', () => {
    assert.strictEqual(stringifyConstructor(Array), '[Array]')
    assert.strictEqual(stringifyConstructor(Object), '[Object]')
    assert.strictEqual(stringifyConstructor(null as any), '[Object: no constructor]')
    assert.strictEqual(stringifyConstructor((() => {}) as any), '[Object: anonymous]')
    assert.strictEqual(stringifyConstructor(class FooBar {}), '[FooBar]')
  })

  it('should stringify a value', () => {
    assert.strictEqual(stringifyValue(null), '<null>')
    assert.strictEqual(stringifyValue(undefined), '<undefined>')

    assert.strictEqual(stringifyValue('foobar'), '"foobar"')
    assert.strictEqual(
        stringifyValue('the quick brown fox jumped over the lazy dog'),
        '"the quick brown fox jumped over the lazy\u2026, length=44"')

    assert.strictEqual(stringifyValue(123), '123')
    assert.strictEqual(stringifyValue(-123), '-123')
    assert.strictEqual(stringifyValue(NaN), 'NaN')
    assert.strictEqual(stringifyValue(Number.POSITIVE_INFINITY), '+Infinity')
    assert.strictEqual(stringifyValue(Number.NEGATIVE_INFINITY), '-Infinity')

    assert.strictEqual(stringifyValue(true), 'true')
    assert.strictEqual(stringifyValue(false), 'false')

    assert.strictEqual(stringifyValue(123n), '123n')
    assert.strictEqual(stringifyValue(-123n), '-123n')

    assert.strictEqual(stringifyValue(() => {}), '<function>')
    assert.strictEqual(stringifyValue(function foo() {}), '<function foo>')

    assert.strictEqual(stringifyValue(Symbol()), '<symbol>')
    assert.strictEqual(stringifyValue(Symbol('foo')), '<symbol foo>')
    assert.strictEqual(stringifyValue(Symbol.for('foo')), '<symbol foo>')

    assert.strictEqual(stringifyValue(/abc/), '/abc/')
    assert.strictEqual(stringifyValue(/abc/gi), '/abc/gi')

    assert.strictEqual(stringifyValue(new Date(0)), '[Date: 1970-01-01T00:00:00.000Z]')

    assert.strictEqual(stringifyValue(new Boolean(true)), '[Boolean: true]')
    assert.strictEqual(stringifyValue(new Boolean(false)), '[Boolean: false]')

    assert.strictEqual(stringifyValue(new Number(123)), '[Number: 123]')
    assert.strictEqual(stringifyValue(new Number(-123)), '[Number: -123]')
    assert.strictEqual(stringifyValue(new Number(NaN)), '[Number: NaN]')
    assert.strictEqual(stringifyValue(new Number(Number.POSITIVE_INFINITY)), '[Number: +Infinity]')
    assert.strictEqual(stringifyValue(new Number(Number.NEGATIVE_INFINITY)), '[Number: -Infinity]')
    assert.strictEqual(stringifyValue(new String('foobar')), '[String: "foobar"]')
    assert.strictEqual(
        stringifyValue(new String('the quick brown fox jumped over the lazy dog')),
        '[String: "the quick brown fox jumped over the lazy\u2026, length=44"]')

    assert.strictEqual(stringifyValue({}), '[Object]')
    assert.strictEqual(stringifyValue([]), '[Array (0)]')
    assert.strictEqual(stringifyValue([ 1, 2, 3 ]), '[Array (3)]')
    assert.strictEqual(stringifyValue(Object.create(null)), '[Object: null prototype]')
    assert.strictEqual(stringifyValue(new class FooBar {}), '[FooBar]')

    assert.strictEqual(stringifyValue(new Set()), '[Set (0)]')
    assert.strictEqual(stringifyValue(new Map()), '[Map (0)]')
    assert.strictEqual(stringifyValue(new Set([ 0 ])), '[Set (1)]')
    assert.strictEqual(stringifyValue(new Map([ [ 0, 0 ] ])), '[Map (1)]')

    const buffer0 = Buffer.from('')
    const buffer1 = Buffer.from('hello')
    const buffer2 = Buffer.from('hello world, and something extra for the kicks')
    assert.strictEqual(stringifyValue(buffer0), '[Buffer: empty]')
    assert.strictEqual(stringifyValue(buffer1), '[Buffer: 68656c6c6f]')
    assert.strictEqual(stringifyValue(buffer2), '[Buffer: 68656c6c6f20776f726c642c20616e6420736f6d\u2026, length=46]')
    assert.strictEqual(stringifyValue(new Uint8Array(2)), '[Uint8Array: 0000]')
    assert.strictEqual(stringifyValue(new ArrayBuffer(1)), '[ArrayBuffer: 00]')
    assert.strictEqual(stringifyValue(new SharedArrayBuffer(0)), '[SharedArrayBuffer: empty]')

    assert.strictEqual(stringifyValue(new TypeError()), '[TypeError]')
    assert.strictEqual(stringifyValue(new SyntaxError('foo')), '[SyntaxError]')

    assert.strictEqual(stringifyValue(new Promise(() => {})), '[Promise]')
    assert.strictEqual(stringifyValue(Promise.resolve('foo')), '[Promise]')

    const rejected = Promise.reject(new Error())
    assert.strictEqual(stringifyValue(rejected), '[Promise]')
    rejected.catch(() => {}) // catch it... avoids "unhandled rejection" in logs
  })

  it('should prefix a type name', () => {
    assert.strictEqual(prefixType('bigint'), 'a <bigint>')
    assert.strictEqual(prefixType('boolean'), 'a <boolean>')
    assert.strictEqual(prefixType('buffer'), 'a <buffer>')
    assert.strictEqual(prefixType('function'), 'a <function>')
    assert.strictEqual(prefixType('map'), 'a <map>')
    assert.strictEqual(prefixType('number'), 'a <number>')
    assert.strictEqual(prefixType('promise'), 'a <promise>')
    assert.strictEqual(prefixType('regexp'), 'a <regexp>')
    assert.strictEqual(prefixType('set'), 'a <set>')
    assert.strictEqual(prefixType('string'), 'a <string>')
    assert.strictEqual(prefixType('symbol'), 'a <symbol>')

    assert.strictEqual(prefixType('array'), 'an <array>')
    assert.strictEqual(prefixType('object'), 'an <object>')

    assert.strictEqual(prefixType('null'), '<null>')
    assert.strictEqual(prefixType('undefined'), '<undefined>')

    assert.strictEqual(prefixType('foo' as any), 'of unknown type <foo>') // edge case
  })
})
