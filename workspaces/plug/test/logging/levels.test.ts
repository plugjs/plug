import { DEBUG, ERROR, getLevelName, getLevelNumber, INFO, NOTICE, OFF, TRACE, WARN } from '../../src/logging/levels.js'

describe('Levels', () => {
  it('should return the proper level name', () => {
    expect(getLevelName(TRACE)).toBe('trace')
    expect(getLevelName(DEBUG)).toBe('debug')
    expect(getLevelName(INFO)).toBe('info')
    expect(getLevelName(NOTICE)).toBe('notice')
    expect(getLevelName(WARN)).toBe('warn')
    expect(getLevelName(ERROR)).toBe('error')
    expect(getLevelName(OFF)).toBe('off')
  })

  it('should return the proper level number', () => {
    expect(getLevelNumber('TRACE')).toBe(TRACE)
    expect(getLevelNumber('DEBUG')).toBe(DEBUG)
    expect(getLevelNumber('INFO')).toBe(INFO)
    expect(getLevelNumber('NOTICE')).toBe(NOTICE)
    expect(getLevelNumber('WARN')).toBe(WARN)
    expect(getLevelNumber('ERROR')).toBe(ERROR)
    expect(getLevelNumber('OFF')).toBe(OFF)

    expect(getLevelNumber('trace')).toBe(TRACE)
    expect(getLevelNumber('debug')).toBe(DEBUG)
    expect(getLevelNumber('info')).toBe(INFO)
    expect(getLevelNumber('notice')).toBe(NOTICE)
    expect(getLevelNumber('warn')).toBe(WARN)
    expect(getLevelNumber('error')).toBe(ERROR)
    expect(getLevelNumber('off')).toBe(OFF)

    expect(getLevelNumber('foobar' as any)).toBe(NOTICE as any)
    expect(getLevelNumber('FOOBAR' as any)).toBe(NOTICE as any)
  })
})
