import { ExpectationError, assertType } from './types'

import type { Expectation, Expectations } from './expect'
import type { Constructor, StringMatcher } from './types'

export class ToThrow implements Expectation {
  expect(
      context: Expectations,
      negative: boolean,
      assert?: (errorExpectations: Expectations) => void,
  ): void {
    assertType(context, 'function')

    let thrown: boolean
    let error: unknown
    try {
      context.value()
      thrown = false
      error = undefined
    } catch (caught) {
      thrown = true
      error = caught
    }

    if (thrown === negative) {
      throw new ExpectationError(context, negative, 'to throw')
    } else if (thrown && assert) {
      assert(context.forValue(error))
    }
  }
}

export class ToThrowError implements Expectation {
  expect(
      context: Expectations,
      negative: boolean,
      ...args:
      | []
      | [ message: StringMatcher ]
      | [ constructor: Constructor<Error> ]
      | [ constructor: Constructor<Error>, message: StringMatcher ]
  ): void {
    context.negated(negative).toThrow((assert) => assert.toBeError(...args))
  }
}
