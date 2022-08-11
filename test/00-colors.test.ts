import { expect } from 'chai'
import { log, logOptions } from '../src'
import * as colors from '../src/log/colors'
import { getCurrentWorkingDirectory, resolveAbsolutePath } from '../src/paths'

describe('Colors', () => {
  it('should print pretty colors', () => {
    const _colors = logOptions.colors
    logOptions.colors = true

    try {
      log(colors.$blu('blue'))
      log(colors.$cyn('cyan'))
      log(colors.$grn('green'))
      log(colors.$gry('gray'))
      log(colors.$mgt('magenta'))
      log(colors.$red('red'))
      log(colors.$wht('white'))
      log(colors.$ylw('yellow'))
      log(colors.$und('underline'))
      log(colors.$t('task'))
      log(colors.$p(resolveAbsolutePath(getCurrentWorkingDirectory(), 'a/relative/path')))
      log('duration', colors.$ms(123456))
    } finally {
      logOptions.colors = _colors
    }
  })

  it('should not emit colors', () => {
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
        colors.$p(resolveAbsolutePath(getCurrentWorkingDirectory(), 'a/relative/path')),
        'duration', colors.$ms(123456),
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
        '"./a/relative/path"',
        'duration',
        '[2m 3s]',
      ])
    } finally {
      logOptions.colors = _colors
    }
  })
})
