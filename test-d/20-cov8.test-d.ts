import '@plugjs/cov8'
import { expectType } from 'tsd'

import type { CoverageOptions, CoverageReportOptions } from '@plugjs/cov8'
import type { Pipe } from '@plugjs/plug'

declare const pipe: Pipe
declare const options: CoverageOptions
declare const reportOptions: CoverageReportOptions

expectType<Promise<undefined>>(pipe.coverage('coverage-data'))
expectType<Promise<undefined>>(pipe.coverage('coverage-data', options))
expectType<Pipe>(pipe.coverage('coverage-data', reportOptions))
expectType<Pipe>(pipe.coverage('coverage-data', { reportDir: 'coverage-report' }))
