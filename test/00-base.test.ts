import { log } from '../src'
import { expect } from 'chai'
import * as idx from '../src/index'

log('Loaded test...')

describe('First Suite', () => {
  it('should run this test', async () => {
    log('YO, INDEX', idx)

    log('Hello, world!')
    expect({ foo: true, baz: 'ok' }).to.eql({ baz: 'no', bar: 123 })
    // assert.equal(, , 'Something wrong...')
  })
})

it('should run a test in the root suite', () => {
  log('Yoo... this is the root suite')
})
