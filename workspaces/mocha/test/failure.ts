import { AssertionError } from 'node:assert'

import { log, assert } from '@plugjs/plug'

function fail(actual: any, expected: any): never {
  const error = new AssertionError({ message: 'An error', actual, expected })
  delete error.stack
  throw error
}

describe('Mocha Failure', () => {
  before(() => log('Hook invoked'))
  after(() => assert(false, 'Hook failure'))

  it('should fail', () => assert(false, 'This is a build failure'))

  // eslint-disable-next-line prefer-promise-reject-errors
  it('should fail with a string', () => Promise.reject('Fail with a string'))

  it('should fail with a message not in the stack', () => {
    const error = new Error('The first message')
    error.stack = 'Error:\n  at foo\n  at bar\n  at baz'
    error.message = 'A different message'
    throw error
  })

  it('should fail with a diff (1)', () => fail({ actual: 'foo' }, { expected: 123 }))
  it('should fail with a diff (2)', () => fail(null, { expected: 123 }))
  it('should fail with a diff (3)', () => fail(undefined, { expected: 123 }))
  it('should fail with a diff (4)', () => fail({ actual: 'foo' }, null))
  it('should fail with a diff (5)', () => fail({ actual: 'foo' }, undefined))
})
