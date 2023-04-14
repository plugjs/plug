import '@plugjs/jasmine'
import { build, find } from '@plugjs/plug'

export default build({
  async ['tsd test'](): Promise<void> {
    await find('**/*.test.ts', { directory: '@' }).jasmine()
  },
})
