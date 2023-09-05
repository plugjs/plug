import { expect } from '@plugjs/expect5'
import { expectType, printType } from 'tsd'

import type { AsyncExpectations } from '@plugjs/expect5'

printType('__file_marker__')

/* === CORE ================================================================= */

// straight expectations
expectType<AsyncExpectations<any>>(expect('' as any))
expectType<AsyncExpectations<unknown>>(expect('' as unknown))

expectType<AsyncExpectations<string>>(expect('foobar'))
expectType<AsyncExpectations<number>>(expect(12345678))
expectType<AsyncExpectations<RegExp>>(expect(/foobar/))
expectType<AsyncExpectations<SyntaxError>>(expect(new SyntaxError()))

// values of Expectations
expectType<string>(expect('foobar').value)
expectType<number>(expect(12345678).value)
expectType<RegExp>(expect(/foobar/).value)
expectType<SyntaxError>(expect(new SyntaxError()).value)
