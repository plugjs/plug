import { expectType, printType } from 'tsd'

import { test } from './index'

printType('__file_marker__')
expectType<number>(test)
