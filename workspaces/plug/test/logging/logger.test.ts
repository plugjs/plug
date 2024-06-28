import { Writable } from 'node:stream'

import { BuildFailure } from '../../src'
import { getLogger, logLevels } from '../../src/logging.js'
import { logOptions } from '../../src/logging/options.js'
import { zapSpinner } from '../../src/logging/spinner.js'

describe('Logger', () => {
  it('should emit a build failure only once', () => {
    const cause1 = new TypeError('This is the cause 1')
    const cause2 = new TypeError('This is the cause 2')
    cause1.stack = cause1.toString()
    cause2.stack = cause2.toString()
    const failure = new BuildFailure('This is the build failure', [ cause1, cause2 ])

    let string = ''
    const out = new Writable({
      write(chunk, _, callback): void {
        string += chunk.toString()
        callback()
      },
    })

    const _colors = logOptions.colors
    const _format = logOptions.format
    const _output = logOptions.output
    const _indent = logOptions.indentSize
    logOptions.colors = false
    logOptions.format = 'plain'
    logOptions.output = out
    logOptions.indentSize = 2

    try {
      const taskName = 'test' + Math.floor(Math.random() * 1000000)
      const log = getLogger(taskName, 0)
      log.error(failure)
      log.error(failure)
      log.error(failure)

      const lines: string[] = string.replaceAll(zapSpinner, '')
          .replaceAll(/^\s+/gm, '')
          .split('\n')
      expect(lines).toEqual([
        `${taskName} │  error │ [TypeError: This is the cause 1]`,
        `${taskName} │  error │ [TypeError: This is the cause 2]`,
        `${taskName} │  error │ This is the build failure`,
        '', // last newline
      ])
    } finally {
      logOptions.colors = _colors
      logOptions.format = _format
      logOptions.output = _output
      logOptions.indentSize = _indent
    }
  })

  it('should emit a build failure with stack at debug level', () => {
    const failure = new BuildFailure('This is the build failure')

    let string = ''
    const out = new Writable({
      write(chunk, _, callback): void {
        string += chunk.toString()
        callback()
      },
    })

    const _level = logOptions.level
    const _colors = logOptions.colors
    const _format = logOptions.format
    const _output = logOptions.output
    const _indent = logOptions.indentSize
    logOptions.level = logLevels.DEBUG
    logOptions.colors = false
    logOptions.format = 'plain'
    logOptions.output = out
    logOptions.indentSize = 2

    try {
      const taskName = 'test' + Math.floor(Math.random() * 1000000)
      const log = getLogger(taskName, 0)
      log.error(failure)

      const lines: string[] = string.replaceAll(zapSpinner, '')
          .replaceAll(/^\s+/gm, '')
          .split('\n')

      expect(lines.length).toBeGreaterThan(1)
      const index = lines.indexOf(`${taskName} │  error │ BuildFailure: This is the build failure`)
      if (index < 0) throw new Error('Unable to find error in log')
      expect(lines[index + 1]).toMatch(`${taskName} │  error │     at `)
    } finally {
      logOptions.level = _level
      logOptions.colors = _colors
      logOptions.format = _format
      logOptions.output = _output
      logOptions.indentSize = _indent
    }
  })

  it('should correctly produce indented logs', () => {
    let string = ''
    const out = new Writable({
      write(chunk, _, callback): void {
        string += chunk.toString()
        callback()
      },
    })

    const _level = logOptions.level
    const _colors = logOptions.colors
    const _format = logOptions.format
    const _output = logOptions.output
    const _indent = logOptions.indentSize
    logOptions.level = logLevels.DEBUG
    logOptions.colors = false
    logOptions.format = 'plain'
    logOptions.output = out
    logOptions.indentSize = 2

    try {
      const taskName = 'test' + Math.floor(Math.random() * 1000000)
      const log = getLogger(taskName, 0)
      log.notice('First')
      log.enter(logLevels.NOTICE, 'Second')
      log.notice('Third')
      log.leave(logLevels.NOTICE, 'Fourth')
      log.notice('Fifth')
      log.leave(logLevels.NOTICE, 'Sixth')
      log.notice('Seventh')

      const lines: string[] = string.replaceAll(zapSpinner, '')
          .replaceAll(/^\s+/gm, '')
          .split('\n')

      expect(lines).toEqual([
        `${taskName} │ notice │ First`,
        `${taskName} │ notice │ Second`,
        `${taskName} │ notice │   Third`,
        `${taskName} │ notice │ Fourth`,
        `${taskName} │ notice │ Fifth`,
        `${taskName} │ notice │ Sixth`,
        `${taskName} │ notice │ Seventh`,
        '', // last newline
      ])
    } finally {
      logOptions.level = _level
      logOptions.colors = _colors
      logOptions.format = _format
      logOptions.output = _output
      logOptions.indentSize = _indent
    }
  })

  it('should correctly emit console logs in forked plugs', () => {
    /* eslint-disable no-console */
    console.log('First')
    console.log('Second')
    console.error('To standard error')
    console.error('To standard error again')
    console.log('Third')
    console.log('Fourth')
  })
})
