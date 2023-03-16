import { EOL } from 'node:os'
import { Writable } from 'node:stream'

import { githubAnnotation } from '../../src/logging/github'
import { logOptions } from '../../src/logging/options.js'

fdescribe('GitHub Annotations', () => {
  it('should produce some annotations', () => {
    const _colors = logOptions.colors
    const _output = logOptions.output
    const _githubAnnotation = logOptions.githubAnnotations

    let string = ''
    const output = new Writable({
      write(chunk, _, callback): void {
        string += chunk.toString()
        callback()
      },
    })

    try {
      logOptions.colors = false
      logOptions.output = output
      logOptions.githubAnnotations = true

      githubAnnotation('warning', 'Hello, world!')
      expect(string).toEqual(`::warning::Hello, world!${EOL}`)
      string = ''

      githubAnnotation('error', 'Hello, world!')
      expect(string).toEqual(`::error::Hello, world!${EOL}`)
      string = ''

      githubAnnotation({
        type: 'warning',
        title: 'Title\nTitle2',
        line: 10,
        col: 20,
      }, 'Hello,\nworld!')
      expect(string).toEqual(`::warning title=Title%0ATitle2,line=10,col=20::Hello,%0Aworld!${EOL}`)
      string = ''

      githubAnnotation({
        type: 'error',
        title: 'Title\nTitle2',
        line: 10,
        col: 20,
      }, 'Hello,\nworld!')
      expect(string).toEqual(`::error title=Title%0ATitle2,line=10,col=20::Hello,%0Aworld!${EOL}`)
      string = ''
    } finally {
      logOptions.colors = _colors
      logOptions.output = _output
      logOptions.githubAnnotations = _githubAnnotation
    }
  })

  it('should make some annotations visible in GitHub', () => {
    const _colors = logOptions.colors
    const _githubAnnotation = logOptions.githubAnnotations

    try {
      logOptions.colors = false
      logOptions.githubAnnotations = true

      githubAnnotation({
        type: 'warning',
        title: 'This is a test',
      }, 'This simple *warning* annotation should be surfaced to GitHub')

      githubAnnotation({
        type: 'error',
        title: 'This is a test',
      }, 'This simple *error* annotation should be surfaced to GitHub')
    } finally {
      logOptions.colors = _colors
      logOptions.githubAnnotations = _githubAnnotation
    }
  })
})
