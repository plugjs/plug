import { expect } from '@plugjs/expect5'
import { expectType, printType } from 'tsd'

import type { Expectations } from '@plugjs/expect5'

printType('__file_marker__')

const unknown: unknown = true as unknown
class TestError extends Error {
  test: boolean = true
}

/* === TO BE REJECTED ======================================================= */

// toBeRejected() - no arguments

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(unknown).toBeRejected(),
)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(Promise.resolve(unknown)).toBeRejected(),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(true).toBeRejected(),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(Promise.resolve(true)).toBeRejected(),
)

/* -------------------------------------------------------------------------- */

// toBeRejected(matcher)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(unknown).toBeRejected(expect.toBeInstanceOf(Error)),
)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(Promise.resolve(unknown)).toBeRejected(expect.toBeInstanceOf(Error)),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(true).toBeRejected(expect.toBeInstanceOf(Error)),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(Promise.resolve(true)).toBeRejected(expect.toBeInstanceOf(Error)),
)

/* -------------------------------------------------------------------------- */

// toBeRejected(assert) - assert returns void

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(unknown).toBeRejected((assert) => {
      expectType<Expectations<unknown>>(assert) // unknown, it's a rejection!
    // return void
    }),
)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(Promise.resolve(unknown)).toBeRejected((assert) => {
      expectType<Expectations<unknown>>(assert) // unknown, it's a rejection!
      // return void
    }),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(true).toBeRejected((assert) => {
      expectType<Expectations<unknown>>(assert) // unknown, it's a rejection!
      // return void
    }),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(Promise.resolve(true)).toBeRejected((assert) => {
      expectType<Expectations<unknown>>(assert) // unknown, it's a rejection!
      // return void
    }),
)

/* -------------------------------------------------------------------------- */

// toBeRejected(assert) - assert returns Expectations<string>

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(unknown).toBeRejected((assert) => {
      expectType<Expectations<unknown>>(assert) // unknown, it's a rejection!
      return assert.toBeA('string')
    }),
)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(Promise.resolve(unknown)).toBeRejected((assert) => {
      expectType<Expectations<unknown>>(assert) // unknown, it's a rejection!
      return assert.toBeA('string')
    }),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(true).toBeRejected((assert) => {
      expectType<Expectations<unknown>>(assert) // unknown, it's a rejection!
      return assert.toBeA('string')
    }),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(Promise.resolve(true)).toBeRejected((assert) => {
      expectType<Expectations<unknown>>(assert) // unknown, it's a rejection!
      return assert.toBeA('string')
    }),
)

/* === TO BE REJECTED WITH ================================================== */

// toBeRejectedWith(...)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(unknown).toBeRejectedWith(new TestError()),
)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(Promise.resolve(unknown)).toBeRejectedWith(new TestError()),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(true).toBeRejectedWith(new TestError()),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(Promise.resolve(true)).toBeRejectedWith(new TestError()),
)

/* === TO BE REJECTED WITH ERROR ============================================ */

// toBeRejectedWithError(...)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(unknown).toBeRejectedWithError(),
)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(Promise.resolve(unknown)).toBeRejectedWithError(),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(true).toBeRejectedWithError(),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(Promise.resolve(true)).toBeRejectedWithError(),
)

/* -------------------------------------------------------------------------- */

// toBeRejectedWithError(...) - only message

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(unknown).toBeRejectedWithError('message'),
)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(Promise.resolve(unknown)).toBeRejectedWithError('message'),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(true).toBeRejectedWithError('message'),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(Promise.resolve(true)).toBeRejectedWithError('message'),
)

/* -------------------------------------------------------------------------- */

// toBeRejectedWithError(...) - only constructor

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(unknown).toBeRejectedWithError(TestError),
)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(Promise.resolve(unknown)).toBeRejectedWithError(TestError),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(true).toBeRejectedWithError(TestError),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(Promise.resolve(true)).toBeRejectedWithError(TestError),
)

/* -------------------------------------------------------------------------- */

// toBeRejectedWithError(...) - constructor and message

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(Promise.resolve(true)).toBeRejectedWithError(TestError, 'message'),
)

/* === TO BE RESOLVED ======================================================= */

// toBeResolved() - no arguments

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(unknown).toBeResolved(),
)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(Promise.resolve(unknown)).toBeResolved(),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(true).toBeResolved(),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(Promise.resolve(true)).toBeResolved(),
)

/* -------------------------------------------------------------------------- */

// toBeResolved(matcher)

expectType<Promise<Expectations<PromiseLike<string>>>>(
    expect(unknown).toBeResolved(expect.toBeA('string')),
)

expectType<Promise<Expectations<PromiseLike<string>>>>(
    expect(Promise.resolve(unknown)).toBeResolved(expect.toBeA('string')),
)

expectType<Promise<Expectations<PromiseLike<string>>>>(
    expect(true).toBeResolved(expect.toBeA('string')),
)

expectType<Promise<Expectations<PromiseLike<string>>>>(
    expect(Promise.resolve(true)).toBeResolved(expect.toBeA('string')),
)

/* -------------------------------------------------------------------------- */

// toBeResolved(assert) - assert returns void

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(unknown).toBeResolved((assert) => {
      expectType<Expectations<unknown>>(assert)
      // return void
    }),
)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(Promise.resolve(unknown)).toBeResolved((assert) => {
      expectType<Expectations<unknown>>(assert)
      // return void
    }),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(true).toBeResolved((assert) => {
      expectType<Expectations<boolean>>(assert)
      // return void
    }),
)

expectType<Promise<Expectations<PromiseLike<boolean>>>>(
    expect(Promise.resolve(true)).toBeResolved((assert) => {
      expectType<Expectations<boolean>>(assert)
      // return void
    }),
)

/* -------------------------------------------------------------------------- */

// toBeResolved(assert) - assert returns Expectations<number>

expectType<Promise<Expectations<PromiseLike<number>>>>(
    expect(unknown).toBeResolved((assert) => {
      expectType<Expectations<unknown>>(assert)
      return assert.toBeA('number')
    }),
)

expectType<Promise<Expectations<PromiseLike<number>>>>(
    expect(Promise.resolve(unknown)).toBeResolved((assert) => {
      expectType<Expectations<unknown>>(assert)
      return assert.toBeA('number')
    }),
)

expectType<Promise<Expectations<PromiseLike<number>>>>(
    expect(true).toBeResolved((assert) => {
      expectType<Expectations<boolean>>(assert)
      return assert.toBeA('number')
    }),
)

expectType<Promise<Expectations<PromiseLike<number>>>>(
    expect(Promise.resolve(true)).toBeResolved((assert) => {
      expectType<Expectations<boolean>>(assert)
      return assert.toBeA('number')
    }),
)

/* === TO BE RESOLVED WITH ================================================== */

// toBeResolvedWith(value) - simple value

expectType<Promise<Expectations<PromiseLike<string>>>>(
    expect(unknown).toBeResolvedWith('foo'),
)

expectType<Promise<Expectations<PromiseLike<string>>>>(
    expect(Promise.resolve(unknown)).toBeResolvedWith('foo'),
)

expectType<Promise<Expectations<PromiseLike<string>>>>(
    expect(true).toBeResolvedWith('foo'),
)

expectType<Promise<Expectations<PromiseLike<string>>>>(
    expect(Promise.resolve(true)).toBeResolvedWith('foo'),
)

/* -------------------------------------------------------------------------- */

// toBeResolvedWith(value) - object deep equal

expectType<Promise<Expectations<PromiseLike<{ foo: string }>>>>(
    expect(unknown).toBeResolvedWith({ foo: 'bar' }),
)

expectType<Promise<Expectations<PromiseLike<{ foo: string }>>>>(
    expect(Promise.resolve(unknown)).toBeResolvedWith({ foo: 'bar' }),
)

expectType<Promise<Expectations<PromiseLike<{ foo: string }>>>>(
    expect(true).toBeResolvedWith({ foo: 'bar' }),
)

expectType<Promise<Expectations<PromiseLike<{ foo: string }>>>>(
    expect(Promise.resolve(true)).toBeResolvedWith({ foo: 'bar' }),
)

/* -------------------------------------------------------------------------- */

// toBeResolvedWith(value) - object with matchers

expectType<Promise<Expectations<PromiseLike<{ foo: string }>>>>(
    expect(unknown).toBeResolvedWith({ foo: expect.toBeA('string') }),
)

expectType<Promise<Expectations<PromiseLike<{ foo: string }>>>>(
    expect(Promise.resolve(unknown)).toBeResolvedWith({ foo: expect.toBeA('string') }),
)

expectType<Promise<Expectations<PromiseLike<{ foo: string }>>>>(
    expect(true).toBeResolvedWith({ foo: expect.toBeA('string') }),
)

expectType<Promise<Expectations<PromiseLike<{ foo: string }>>>>(
    expect(Promise.resolve(true)).toBeResolvedWith({ foo: expect.toBeA('string') }),
)
