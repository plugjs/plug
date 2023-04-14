import { build, find } from '@plugjs/plug'

import { Test } from '../src/test'

export default build({
  async ['expect5 test'](): Promise<void> {
    await find('*.test.ts', { directory: '@' }).plug(new Test())
  },
})
