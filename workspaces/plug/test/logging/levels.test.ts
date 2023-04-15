import { DEBUG, ERROR, getLevelName, getLevelNumber, INFO, NOTICE, OFF, TRACE, WARN } from '../../src/logging/levels.js'

describe('Levels', () => {
  it('should return the proper level name', () => {
    expect(getLevelName(TRACE)).toStrictlyEqual('trace')
    expect(getLevelName(DEBUG)).toStrictlyEqual('debug')
    expect(getLevelName(INFO)).toStrictlyEqual('info')
    expect(getLevelName(NOTICE)).toStrictlyEqual('notice')
    expect(getLevelName(WARN)).toStrictlyEqual('warn')
    expect(getLevelName(ERROR)).toStrictlyEqual('error')
    expect(getLevelName(OFF)).toStrictlyEqual('off')
  })

  it('should return the proper level number', () => {
    expect(getLevelNumber('TRACE')).toStrictlyEqual(TRACE)
    expect(getLevelNumber('DEBUG')).toStrictlyEqual(DEBUG)
    expect(getLevelNumber('INFO')).toStrictlyEqual(INFO)
    expect(getLevelNumber('NOTICE')).toStrictlyEqual(NOTICE)
    expect(getLevelNumber('WARN')).toStrictlyEqual(WARN)
    expect(getLevelNumber('ERROR')).toStrictlyEqual(ERROR)
    expect(getLevelNumber('OFF')).toStrictlyEqual(OFF)

    expect(getLevelNumber('trace')).toStrictlyEqual(TRACE)
    expect(getLevelNumber('debug')).toStrictlyEqual(DEBUG)
    expect(getLevelNumber('info')).toStrictlyEqual(INFO)
    expect(getLevelNumber('notice')).toStrictlyEqual(NOTICE)
    expect(getLevelNumber('warn')).toStrictlyEqual(WARN)
    expect(getLevelNumber('error')).toStrictlyEqual(ERROR)
    expect(getLevelNumber('off')).toStrictlyEqual(OFF)

    expect(getLevelNumber('foobar' as any)).toStrictlyEqual(NOTICE as any)
    expect(getLevelNumber('FOOBAR' as any)).toStrictlyEqual(NOTICE as any)
  })
})
