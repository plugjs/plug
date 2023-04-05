import { ExpectationError, stringifyValue } from './types'

import type { Expectation, Expectations } from './expect'

/** A simple {@link Expectation} performing a basic true/false check */
abstract class VoidExpectation implements Expectation {
  constructor(
      private _details: string,
      private _check: (value: unknown) => boolean,
  ) {}

  expect(context: Expectations, negative: boolean): void {
    const check = this._check(context.value)
    if (check === negative) {
      throw new ExpectationError(context, negative, this._details)
    }
  }
}

/* ========================================================================== */

export class ToBeDefined extends VoidExpectation {
  constructor() {
    super('to be defined', (value) => (value !== null) && (value !== undefined))
  }
}

export class ToBeFalse extends VoidExpectation {
  constructor() {
    super(`to be ${stringifyValue(false)}`, (value) => value === false)
  }
}

export class ToBeFalsy extends VoidExpectation {
  constructor() {
    super('to be falsy', (value) => ! value)
  }
}

export class ToBeNaN extends VoidExpectation {
  constructor() {
    super(`to be ${stringifyValue(NaN)}`, (value) => (typeof value === 'number') && isNaN(value))
  }
}

export class ToBeNegativeInfinity extends VoidExpectation {
  constructor() {
    super(`to equal ${stringifyValue(Number.NEGATIVE_INFINITY)}`, (value) => value === Number.NEGATIVE_INFINITY)
  }
}

export class ToBeNull extends VoidExpectation {
  constructor() {
    super(`to be ${stringifyValue(null)}`, (value) => value === null)
  }
}

export class ToBePositiveInfinity extends VoidExpectation {
  constructor() {
    super(`to equal ${stringifyValue(Number.POSITIVE_INFINITY)}`, (value) => value === Number.POSITIVE_INFINITY)
  }
}

export class ToBeTrue extends VoidExpectation {
  constructor() {
    super(`to be ${stringifyValue(true)}`, (value) => value === true)
  }
}

export class ToBeTruthy extends VoidExpectation {
  constructor() {
    super('to be truthy', (value) => !! value)
  }
}

export class ToBeUndefined extends VoidExpectation {
  constructor() {
    super(`to be ${stringifyValue(undefined)}`, (value) => value === undefined)
  }
}
