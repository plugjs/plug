import { expect } from 'chai'

import { DEBUG, ERROR, getLevelName, getLevelNumber, INFO, NOTICE, OFF, TRACE, WARN } from '../../src/logging/levels.js'

describe('Levels', () => {
  it('should return the proper level name', () => {
    expect(getLevelName(TRACE)).to.equal('trace')
    expect(getLevelName(DEBUG)).to.equal('debug')
    expect(getLevelName(INFO)).to.equal('info')
    expect(getLevelName(NOTICE)).to.equal('notice')
    expect(getLevelName(WARN)).to.equal('warn')
    expect(getLevelName(ERROR)).to.equal('error')
    expect(getLevelName(OFF)).to.equal('off')
  })

  it('should return the proper level number', () => {
    expect(getLevelNumber('TRACE')).to.equal(TRACE)
    expect(getLevelNumber('DEBUG')).to.equal(DEBUG)
    expect(getLevelNumber('INFO')).to.equal(INFO)
    expect(getLevelNumber('NOTICE')).to.equal(NOTICE)
    expect(getLevelNumber('WARN')).to.equal(WARN)
    expect(getLevelNumber('ERROR')).to.equal(ERROR)
    expect(getLevelNumber('OFF')).to.equal(OFF)

    expect(getLevelNumber('trace')).to.equal(TRACE)
    expect(getLevelNumber('debug')).to.equal(DEBUG)
    expect(getLevelNumber('info')).to.equal(INFO)
    expect(getLevelNumber('notice')).to.equal(NOTICE)
    expect(getLevelNumber('warn')).to.equal(WARN)
    expect(getLevelNumber('error')).to.equal(ERROR)
    expect(getLevelNumber('off')).to.equal(OFF)

    expect(getLevelNumber('foobar' as any)).to.equal(NOTICE)
    expect(getLevelNumber('FOOBAR' as any)).to.equal(NOTICE)
  })
})
