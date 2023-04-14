import { ForkingPlug } from '../src/fork'
import { build, find } from '../src/index'
import { requireResolve } from '../src/paths'

export default build({
  find_tests: () => find('**/*.test.([cm])?ts', { directory: '@', ignore: '**/*.d.ts' }),

  async ['plug test']() {
    const jasmineScript = requireResolve(__fileurl, '../../jasmine/src/jasmine')

    const ForkingJasmine = class extends ForkingPlug {
      constructor(...args: any[]) {
        super(jasmineScript, args, 'Jasmine')
      }
    }

    await this.find_tests().plug(new ForkingJasmine())
  },
})
