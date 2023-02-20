import '@plugjs/jasmine'

import { build, find } from '@plugjs/plug'

export default build({
  find_tests: () => find('**/*.test.([cm])?ts', { directory: '@', ignore: '**/*.d.ts' }).debug(),

  async test() {
    // const jasmine = import('../../jasmine/src/jasmine.js')
    // const Jasmine = (await jasmine).default.Jasmine

    await this.find_tests().jasmine() // .plug(new Jasmine())
  },
})
