import { describe, it } from 'mocha'
import { log } from '../src'

log('Loaded test...')

describe('Root Suite', () => {
  it('should run this test', () => {
    log('Hello, world!')
  })
})
