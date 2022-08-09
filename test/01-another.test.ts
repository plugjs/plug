import { log } from '../src'

log('Loaded test 2...')

describe('Second suite', () => {
  after(() => {
    log.error('After hook in suite')
  })

  it('should run this test part 2', () => {
    log('Hello, world!')
  })
})

describe('Another Suite', () => {
  it('another test', () => {
    throw new Error('This is on\n Two lines!') // 'a string'
    // log('Hello, world!')
  })
  it('this test will be skipped', function() {
    this.skip()
    // log('Hello, world!')
  })
})

describe('Empty Suite', () => {
  // it('another test', () => {
  //   // log('Hello, world!')
  // })
  // it('this test will be skipped', function() {
  //   this.skip()
  //   // log('Hello, world!')
  // })
})

before(() => {
  log.warn('Global hook!!!')
})
