import assert from 'node:assert'
import { currentRun } from '../../src/async'
import { $gry } from '../../src/log/colors'
import { TRACE } from '../../src/log/levels'

describe('Emit', () => {
  it('should emit with pretty colors', () => {
    const run = currentRun()
    assert(run)

    const _level = run.log.level
    run.log.level = TRACE

    try {
      run.log.trace($gry('|'), 'trace ', 123, { foo: 'bar' })
      run.log.debug($gry('|'), 'debug ', 123, { foo: 'bar' })
      run.log.info($gry('|'), 'info  ', 123, { foo: 'bar' })
      run.log.notice($gry('|'), 'notice', 123, { foo: 'bar' })
      run.log.warn($gry('|'), 'warn  ', 123, { foo: 'bar' })
      run.log.error($gry('|'), 'error ', 123, { foo: 'bar' })
    } finally {
      run.log.level = _level
    }
  })
})
