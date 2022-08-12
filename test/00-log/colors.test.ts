import { expect } from 'chai'

import * as colors from '../../src/log/colors'

import { log, logOptions } from '../../src'
import { getCurrentWorkingDirectory, resolveAbsolutePath } from '../../src/paths'

describe('Colors', () => {
  const cwd = getCurrentWorkingDirectory()
  const rel = resolveAbsolutePath(cwd, 'a/relative/path')
  const abs = resolveAbsolutePath(cwd, '/an/absolute/path')

  it('should print pretty colors', () => {
    const _colors = logOptions.colors
    logOptions.colors = true

    try {
      log(colors.$gry('|'), colors.$blu('blue'))
      log(colors.$gry('|'), colors.$cyn('cyan'))
      log(colors.$gry('|'), colors.$grn('green'))
      log(colors.$gry('|'), colors.$gry('gray'))
      log(colors.$gry('|'), colors.$mgt('magenta'))
      log(colors.$gry('|'), colors.$red('red'))
      log(colors.$gry('|'), colors.$wht('white'))
      log(colors.$gry('|'), colors.$ylw('yellow'))
      log(colors.$gry('|'), colors.$und('underline'))
      log(colors.$gry('|'), colors.$t('task'))
      log(colors.$gry('|'), colors.$p(rel))
      log(colors.$gry('|'), 'duration', colors.$ms(123456))
    } finally {
      logOptions.colors = _colors
    }
  })

  it('should emit the correct values', () => {
    const _colors = logOptions.colors
    logOptions.colors = false

    try {
      const strings: string[] = [
        colors.$blu('blue'),
        colors.$cyn('cyan'),
        colors.$grn('green'),
        colors.$gry('gray'),
        colors.$mgt('magenta'),
        colors.$red('red'),
        colors.$wht('white'),
        colors.$ylw('yellow'),
        colors.$und('underline'),
        colors.$t('task'),
        // paths
        colors.$p(rel),
        colors.$p(abs),
        // times
        colors.$ms(1),
        colors.$ms(10),
        colors.$ms(100),
        colors.$ms(1000),
        colors.$ms(1200),
        colors.$ms(1234),
        colors.$ms(10000),
        colors.$ms(12000),
        colors.$ms(12345),
        colors.$ms(60000),
        colors.$ms(61000),
        colors.$ms(123456),
      ]
      expect(strings).to.eql([
        'blue',
        'cyan',
        'green',
        'gray',
        'magenta',
        'red',
        'white',
        'yellow',
        'underline',
        '"task"',
        // paths
        '"./a/relative/path"',
        '"/an/absolute/path"',
        // times
        '[1ms]',
        '[10ms]',
        '[100ms]',
        '[1.0s]',
        '[1.20s]',
        '[1.23s]',
        '[10.0s]',
        '[12.0s]',
        '[12.3s]',
        '[1m 0s]',
        '[1m 1s]',
        '[2m 3s]',
      ])
    } finally {
      logOptions.colors = _colors
    }
  })
})
