import { log } from '@plugjs/plug'

it('should have been setup', function(this: { isSetup?: boolean | undefined }) {
  log('In the test the value of "isSetup" is', this.isSetup)
  expect(this.isSetup).toBeTrue()
})
