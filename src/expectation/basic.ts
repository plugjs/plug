import { assertType, ExpectationError, type Constructor, type TypeName, isType, stringifyValue, prefixType } from './types'

import type { Expectation, ExpectationContext } from './expect'

/* ========================================================================== *
 * BASIC EXPECTATIONS: deferring any value to the matcher                     *
 * ========================================================================== */

export class ToBeA implements Expectation {
  expect(context: ExpectationContext, type: TypeName): void {
    const match = isType(context, type)
    if (match !== context.negative) return
    throw new ExpectationError(context, `be ${prefixType(type)}`)
  }
}

export class ToBeInstanceOf implements Expectation {
  expect(context: ExpectationContext, value: Constructor): void {
    const match = context.value instanceof value
    if (match !== context.negative) return
    throw new ExpectationError(context, `be an instance of ${value.name}`)
  }
}

export class ToHaveLength implements Expectation {
  expect(context: ExpectationContext, length: number): void {
    const { value } = context

    if (value && ((value as any).length === length)) return
    if ((value instanceof Map) && (value.size === length)) return
    if ((value instanceof Set) && (value.size === length)) return

    throw new ExpectationError(context, `have length ${length}`)
  }
}

export class ToMatch implements Expectation {
  expect(context: ExpectationContext, expr: RegExp): void {
    assertType(context, 'string')

    const match = !! context.value.match(expr)
    if (match !== context.negative) return

    throw new ExpectationError(context, `match ${expr}`)
  }
}

export class ToStrictlyEqual implements Expectation {
  expect(context: ExpectationContext, value: any): void {
    const match = context.value === value
    if (match !== context.negative) return
    throw new ExpectationError(context, `to strictly equal ${stringifyValue(value)}`)
  }
}

export class ToThrowError implements Expectation {
  expect(
      context: ExpectationContext,
      ...args:
      | [ message: string | RegExp ]
      | [ constructor: Constructor<Error> ]
      | [ constructor: Constructor<Error>, message: string | RegExp ]
  ): void {
    if (context.negative) throw new SyntaxError('Unsupported negative match "toThrowError(...), use "expect.not.toThrow()"')

    assertType(context, 'function')

    try {
      context.value()
      throw new ExpectationError(context, 'throw')
    } catch (error) {
      // get message and constructor from arguments
      let constructor: Constructor<Error> | undefined
      let message: string | RegExp | undefined

      if (typeof args[0] === 'function') {
        constructor = args[0]
        message = args[1]
      } else {
        constructor = undefined
        message = args[0]
      }

      // check constructor and message using sub-expectations
      if (constructor) toBeInstanceOf.expect(context, constructor)
      if (typeof message === 'string') {
        toStrictlyEqual.expect(context, message)
      } else if (message instanceof RegExp) {
        toMatch.expect(context, message)
      }
    }
  }
}

export class ToThrowMatching implements Expectation {
  expect(context: ExpectationContext, matcher: (value: unknown) => void): void {
    if (context.negative) throw new SyntaxError('Unsupported negative match "toThrowMatching(...), use "expect.not.toThrow()"')

    assertType(context, 'function')

    try {
      context.value()
      throw new ExpectationError(context, 'throw')
    } catch (error) {
      matcher(error)
    }
  }
}


/* ========================================================================== */

export const toBeA = new ToBeA()
export const toBeInstanceOf = new ToBeInstanceOf()
export const toHaveLength = new ToHaveLength()
export const toMatch = new ToMatch()
export const toStrictlyEqual = new ToStrictlyEqual()
export const toThrowError = new ToThrowError()
export const toThrowMatching = new ToThrowMatching()
