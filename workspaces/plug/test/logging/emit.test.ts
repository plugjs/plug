import assert from 'node:assert'
import { Writable } from 'node:stream'

import { currentContext } from '../../src/async.js'
import { log } from '../../src/logging.js'
import { $gry } from '../../src/logging/colors.js'
import { emit } from '../../src/logging/emit.js'
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
      run.log.trace($gry('| context'), 'trace ', 123, { foo: 'bar' })
      run.log.debug($gry('| context'), 'debug ', 123, { foo: 'bar' })
      run.log.info($gry('| context'), 'info  ', 123, { foo: 'bar' })
      run.log.notice($gry('| context'), 'notice', 123, { foo: 'bar' })
      run.log.warn($gry('| context'), 'warn  ', 123, { foo: 'bar' })
      run.log.error($gry('| context'), 'error ', 123, { foo: 'bar' })
      // shared log
      log.trace($gry('| shared '), 'trace ', 123, { foo: 'bar' })
      log.debug($gry('| shared '), 'debug ', 123, { foo: 'bar' })
      log.info($gry('| shared '), 'info  ', 123, { foo: 'bar' })
      log.notice($gry('| shared '), 'notice', 123, { foo: 'bar' })
      log.warn($gry('| shared '), 'warn  ', 123, { foo: 'bar' })
      log.error($gry('| shared '), 'error ', 123, { foo: 'bar' })
    } finally {
      run.log.level = _level
    }
  })

  it('should emit the correct values for fancy output', () => {
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
    const _format = logOptions.format
    const _indent = logOptions.indentSize
    logOptions.colors = false
    logOptions.output = out
    logOptions.format = 'fancy'
    logOptions.indentSize = 2

    try {
      emit({ level: TRACE, taskName }, [ 'trace', 123, { foo: 'bar' } ])
      emit({ level: DEBUG, taskName }, [ 'debug', 123, { foo: 'bar' } ])
      emit({ level: INFO, taskName }, [ 'info', 123, { foo: 'bar' } ])
      emit({ level: NOTICE, taskName }, [ 'notice', 123, { foo: 'bar' } ])
      emit({ level: WARN, taskName }, [ 'warn', 123, { foo: 'bar' } ])
      emit({ level: ERROR, taskName }, [ 'error', 123, { foo: 'bar' } ])
      emit({ level: ERROR, taskName, indent: 4 }, [ 'indented' ])
      emit({ level: ERROR, taskName, prefix: '{prefix}' }, [ 'prefixed' ])

      const lines: string[] = string.replaceAll(zapSpinner, '')
          .replaceAll(/^\s+/gm, '')
          .split('\n')
      expect(lines).toEqual([
        `${taskName} \u25a1 trace 123 { foo: 'bar' }`,
        `${taskName} \u25a0 debug 123 { foo: 'bar' }`,
        `${taskName} \u25a0 info 123 { foo: 'bar' }`,
        `${taskName} \u25a0 notice 123 { foo: 'bar' }`,
        `${taskName} \u25a0 warn 123 { foo: 'bar' }`,
        `${taskName} \u25a0 error 123 { foo: 'bar' }`,
        `${taskName} \u25a0         indented`,
        `${taskName} \u25a0 {prefix}prefixed`,
        '', // last newline
      ])
    } finally {
      logOptions.colors = _colors
      logOptions.output = _output
      logOptions.format = _format
      logOptions.indentSize = _indent
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
    const _format = logOptions.format
    const _indent = logOptions.indentSize
    logOptions.colors = false
    logOptions.output = out
    logOptions.format = 'plain'
    logOptions.indentSize = 2

    try {
      emit({ level: TRACE, taskName }, [ 'trace', 123, { foo: 'bar' } ])
      emit({ level: DEBUG, taskName }, [ 'debug', 123, { foo: 'bar' } ])
      emit({ level: INFO, taskName }, [ 'info', 123, { foo: 'bar' } ])
      emit({ level: NOTICE, taskName }, [ 'notice', 123, { foo: 'bar' } ])
      emit({ level: WARN, taskName }, [ 'warn', 123, { foo: 'bar' } ])
      emit({ level: ERROR, taskName }, [ 'error', 123, { foo: 'bar' } ])
      emit({ level: ERROR, taskName, indent: 4 }, [ 'indented' ])
      emit({ level: ERROR, taskName, prefix: '{prefix}' }, [ 'prefixed' ])

      const lines: string[] = string.replaceAll(zapSpinner, '')
          .replaceAll(/^\s+/gm, '')
          .split('\n')

      expect(lines).toEqual([
        `${taskName} │  trace │ trace 123 { foo: 'bar' }`,
        `${taskName} │  debug │ debug 123 { foo: 'bar' }`,
        `${taskName} │   info │ info 123 { foo: 'bar' }`,
        `${taskName} │ notice │ notice 123 { foo: 'bar' }`,
        `${taskName} │   warn │ warn 123 { foo: 'bar' }`,
        `${taskName} │  error │ error 123 { foo: 'bar' }`,
        `${taskName} │  error │         indented`,
        `${taskName} │  error │ {prefix}prefixed`,
        '', // last newline
      ])
    } finally {
      logOptions.colors = _colors
      logOptions.output = _output
      logOptions.format = _format
      logOptions.indentSize = _indent
    }
  })
})
