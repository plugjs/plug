import { diff } from './diff'
import { assertType, ExpectationError, isType, prefixType, stringifyConstructor, stringifyValue } from './types'

import type { Constructor, TypeName, StringMatcher } from './types'
import type { Expectation, Expectations } from './expect'

export class ToBeA implements Expectation {
  expect(context: Expectations, negative: boolean, type: TypeName): void {
    const match = isType(context, type)
    if (match !== negative) return
    throw new ExpectationError(context, negative, `to be ${prefixType(type)}`)
  }
}

export class ToBeCloseTo implements Expectation {
  expect(
      context: Expectations,
      negative: boolean,
      ...[ value, delta ]:
      | [ value: number, delta: number ]
      | [ value: bigint, delta: bigint ]
  ): void {
    const min = (value as number) - (delta as number)
    const max = (value as number) + (delta as number)
    context.negated(negative).toBeWithinRange(min, max)
  }
}

export class ToBeError implements Expectation {
  expect(
      context: Expectations,
      negative: boolean,
      ...args:
      | []
      | [ message: StringMatcher ]
      | [ constructor: Constructor<Error> ]
      | [ constructor: Constructor<Error>, message: StringMatcher ]
  ): void {
    const [ constructor, message ] =
    typeof args[0] === 'function' ?
      [ args[0], args[1] ] :
      [ Error, args[0] ]

    context.negated(negative).toBeInstanceOf(constructor)
    if (negative || (message === undefined)) return // if "not.toBeError" ignore the message

    context.toHaveProperty('message', (assert) => {
      assertType(assert, 'string')
      if (typeof message === 'string') assert.toStrictlyEqual(message)
      else assert.toMatch(message)
    })
  }
}

export class ToBeGreaterThan implements Expectation {
  expect(context: Expectations, negative: boolean, value: number | bigint): void {
    assertType(context, typeof value as 'number' | 'bigint')
    if ((context.value > value) !== negative) return
    throw new ExpectationError(context, negative, `to be greater than ${stringifyValue(value)}`)
  }
}

export class ToBeGreaterThanOrEqual implements Expectation {
  expect(context: Expectations, negative: boolean, value: number | bigint): void {
    assertType(context, typeof value as 'number' | 'bigint')
    if ((context.value >= value) !== negative) return
    throw new ExpectationError(context, negative, `to be greater than or equal to ${stringifyValue(value)}`)
  }
}

export class ToBeInstanceOf implements Expectation {
  expect(context: Expectations, negative: boolean, value: Constructor): void {
    const match = context.value instanceof value
    if (match !== negative) return
    throw new ExpectationError(context, negative, `to be an instance of ${stringifyConstructor(value)}`)
  }
}

export class ToBeLessThan implements Expectation {
  expect(context: Expectations, negative: boolean, value: number | bigint): void {
    assertType(context, typeof value as 'number' | 'bigint')
    if ((context.value < value) !== negative) return
    throw new ExpectationError(context, negative, `to be less than ${stringifyValue(value)}`)
  }
}

export class ToBeLessThanOrEqual implements Expectation {
  expect(context: Expectations, negative: boolean, value: number | bigint): void {
    assertType(context, typeof value as 'number' | 'bigint')
    if ((context.value <= value) !== negative) return
    throw new ExpectationError(context, negative, `to be less than or equal to ${stringifyValue(value)}`)
  }
}

export class ToBeWithinRange implements Expectation {
  expect(
      context: Expectations,
      negative: boolean,
      ...[ min, max ]:
      | [ min: number, max: number ]
      | [ min: bigint, max: bigint ]
  ): void {
    if (max < min) {
      const num = max
      max = min
      min = num
    }

    assertType(context, typeof min as 'number' | 'bigint')
    if (((context.value >= min) && (context.value <= max)) !== negative) return
    throw new ExpectationError(context, negative, `to be within ${stringifyValue(min)}...${stringifyValue(max)}`)
  }
}

export class ToEqual implements Expectation {
  expect(context: Expectations, negative: boolean, expected: any): void {
    const result = diff(context.value, expected)
    if (result.diff === negative) return
    throw new ExpectationError(context, negative, `to equal ${stringifyValue(expected)}`, result)
  }
}

export class ToHaveLength implements Expectation {
  expect(context: Expectations, negative: boolean, length: number): void {
    context.toBeDefined()

    const actualLength = (context.value as any).length
    if (typeof actualLength !== 'number') {
      throw new ExpectationError(context, false, 'to have a numeric "length" property')
    }

    if ((actualLength === length) === negative) {
      throw new ExpectationError(context, negative, `to have length ${stringifyValue(length)}`)
    }
  }
}

export class ToHaveProperty implements Expectation {
  expect(
      context: Expectations,
      negative: boolean,
      prop: string | number | symbol,
      assert?: (propertyExpectations: Expectations) => void,
  ): void {
    context.toBeDefined()

    const match = (context.value as any)[prop] !== undefined
    if (match === negative) {
      throw new ExpectationError(context, negative, `to have property "${String(prop)}"`)
    } else if (match && assert) {
      assert(context.forProperty(prop))
    }
  }
}

export class ToHaveSize implements Expectation {
  expect(context: Expectations, negative: boolean, size: number): void {
    context.toBeDefined()

    const actualSize = (context.value as any).size
    if (typeof actualSize !== 'number') {
      throw new ExpectationError(context, false, 'to have a numeric "size" property')
    }

    if ((actualSize === size) === negative) {
      throw new ExpectationError(context, negative, `to have size ${stringifyValue(size)}`)
    }
  }
}

export class ToMatch implements Expectation {
  expect(
      context: Expectations,
      negative: boolean,
      expr: StringMatcher,
  ): void {
    assertType(context, 'string')

    const match = !! context.value.match(expr as string | RegExp) // meh, overloads
    if (match !== negative) return

    throw new ExpectationError(context, negative, `to match ${stringifyValue(expr)}`)
  }
}

export class ToStrictlyEqual implements Expectation {
  expect(context: Expectations, negative: boolean, value: any): void {
    const match = context.value === value
    if (match !== negative) return
    // TODO: add diff
    throw new ExpectationError(context, negative, `to strictly equal ${stringifyValue(value)}`)
  }
}
