import '@plugjs/expect5'
import { build, find } from '@plugjs/plug'

export default build({
  async ['eslint test'](): Promise<void> {
    await find('**/*.test.ts', { directory: '@' }).test()
  },
})
