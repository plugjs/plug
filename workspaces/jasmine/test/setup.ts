import { log } from '@plugjs/plug'

beforeAll(function(this: { isSetup?: boolean | undefined }) {
  log('Setting up Jasmine')
  this.isSetup = true
})
