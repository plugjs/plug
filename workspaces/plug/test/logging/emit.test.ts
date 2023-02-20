import assert from 'node:assert'
import { Writable } from 'node:stream'

import { currentContext } from '../../src/async.js'
import { $gry } from '../../src/logging/colors.js'
import { emitColor, emitPlain } from '../../src/logging/emit.js'
import { DEBUG, ERROR, INFO, NOTICE, TRACE, WARN } from '../../src/logging/levels.js'
import { logOptions } from '../../src/logging/options.js'
import { zapSpinner } from '../../src/logging/spinner.js'

describe('Emit', () => {
  it('should log some messages', () => {
    const run = currentContext() // this might fail if not just-in-time transpiled
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

  it('should emit the correct values for colorized output', () => {
    const run = currentContext() // this might fail if not just-in-time transpiled
    assert(run)

    let string = ''
    const out = new Writable({
      write(chunk, _, callback): void {
        string += chunk.toString()
        callback()
      },
    })

    const taskName = run.taskName

    const _colors = logOptions.colors
    const _output = logOptions.output
    logOptions.colors = false
    logOptions.output = out

    try {
      emitColor({ level: TRACE, taskName }, [ 'trace', 123, { foo: 'bar' } ])
      emitColor({ level: DEBUG, taskName }, [ 'debug', 123, { foo: 'bar' } ])
      emitColor({ level: INFO, taskName }, [ 'info', 123, { foo: 'bar' } ])
      emitColor({ level: NOTICE, taskName }, [ 'notice', 123, { foo: 'bar' } ])
      emitColor({ level: WARN, taskName }, [ 'warn', 123, { foo: 'bar' } ])
      emitColor({ level: ERROR, taskName }, [ 'error', 123, { foo: 'bar' } ])
      emitColor({ level: ERROR, taskName, indent: 4 }, [ 'indented' ])
      emitColor({ level: ERROR, taskName, prefix: '{prefix}' }, [ 'prefixed' ])

      // @ts-ignore // why isn't replaceAll picked up by lib "esnext"?
      const lines: string = string.replaceAll(zapSpinner, '')
          .replaceAll(/^\s+/gm, '')
          .split('\n')
      expect(lines).toEqual([
        '"test" \u25a1 trace 123 { foo: \'bar\' }',
        '"test" \u25a0 debug 123 { foo: \'bar\' }',
        '"test" \u25a0 info 123 { foo: \'bar\' }',
        '"test" \u25a0 notice 123 { foo: \'bar\' }',
        '"test" \u25a0 warn 123 { foo: \'bar\' }',
        '"test" \u25a0 error 123 { foo: \'bar\' }',
        '"test" \u25a0         indented',
        '"test" \u25a0 {prefix}prefixed',
        '', // last newline
      ])
    } finally {
      logOptions.colors = _colors
      logOptions.output = _output
    }
  })


  it('should emit the correct values for plain output', () => {
    const run = currentContext() // this might fail if not just-in-time transpiled
    assert(run)

    let string = ''
    const out = new Writable({
      write(chunk, _, callback): void {
        string += chunk.toString()
        callback()
      },
    })

    const taskName = run.taskName

    const _colors = logOptions.colors
    const _output = logOptions.output
    const _indent = logOptions.indentSize
    logOptions.colors = false
    logOptions.output = out
    logOptions.indentSize = 2

    try {
      emitPlain({ level: TRACE, taskName }, [ 'trace', 123, { foo: 'bar' } ])
      emitPlain({ level: DEBUG, taskName }, [ 'debug', 123, { foo: 'bar' } ])
      emitPlain({ level: INFO, taskName }, [ 'info', 123, { foo: 'bar' } ])
      emitPlain({ level: NOTICE, taskName }, [ 'notice', 123, { foo: 'bar' } ])
      emitPlain({ level: WARN, taskName }, [ 'warn', 123, { foo: 'bar' } ])
      emitPlain({ level: ERROR, taskName }, [ 'error', 123, { foo: 'bar' } ])
      emitPlain({ level: ERROR, taskName, indent: 4 }, [ 'indented' ])
      emitPlain({ level: ERROR, taskName, prefix: '{prefix}' }, [ 'prefixed' ])

      // @ts-ignore // why isn't replaceAll picked up by lib "esnext"?
      const lines: string = string.replaceAll(zapSpinner, '')
          .replaceAll(/^\s+/gm, '')
          .split('\n')
      expect(lines).toEqual([
        'test │  trace │ trace 123 { foo: \'bar\' }',
        'test │  debug │ debug 123 { foo: \'bar\' }',
        'test │   info │ info 123 { foo: \'bar\' }',
        'test │ notice │ notice 123 { foo: \'bar\' }',
        'test │   warn │ warn 123 { foo: \'bar\' }',
        'test │  error │ error 123 { foo: \'bar\' }',
        'test │  error │         indented',
        'test │  error │ {prefix}prefixed',
        '', // last newline
      ])
    } finally {
      logOptions.colors = _colors
      logOptions.output = _output
      logOptions.indentSize = _indent
    }
  })
})
