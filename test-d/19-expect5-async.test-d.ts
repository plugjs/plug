import { expectType, printType } from 'tsd'
import { expect, type Expectations } from '@plugjs/expect5'

printType('__file_marker__')

const unknown: unknown = true as unknown

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

/* === TO BE REJECTED WITH ERROR ============================================ */

// toBeRejectedWithError(...)

class TestError extends Error {
  test: boolean = true
}

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(unknown).toBeRejectedWithError('message'),
)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(unknown).toBeRejectedWithError(TestError),
)

expectType<Promise<Expectations<PromiseLike<unknown>>>>(
    expect(unknown).toBeRejectedWithError(TestError, 'message'),
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
