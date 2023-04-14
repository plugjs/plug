import { ForkingPlug } from '../src/fork'
import { build, find, log } from '../src/index'
import { requireResolve } from '../src/paths'

export default build({
  async ['plug test']() {
    const expect5 = requireResolve(__fileurl, '../../expect5/src/test')

    const ForkingTest = class extends ForkingPlug {
      constructor(...args: any[]) {
        super(expect5, args, 'Test')
      }
    }

    try {
      await find('**/*.test.([cm])?ts', { directory: '@', ignore: '**/*.d.ts' })
          .plug(new ForkingTest())
    } catch (error) {
      log.error('GOTTEN ERROR', error)
      setTimeout(() => {}, 2000)
    }
  },
})
