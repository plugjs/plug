import '@plugjs/expect5'
import { build, find } from '@plugjs/plug'

export default build({
  async ['typescript test'](): Promise<void> {
    await find('**.test.ts', { directory: '@' }).test()
  },
})
