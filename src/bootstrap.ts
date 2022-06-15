import { build } from './build'
import { log } from './log'
// import { from } from './task'

const b = build({
  compile() {
    log.info('Hello, compile!')
    return this.find('**/*.ts', { directory: 'src' })
  },
  runme() {
    log.info('Hello, runme!')
    return this.find('types/**/*.ts')
    // this.call('compile')
  },
  default() {
    return this.call('compile', 'runme')
    // return this.find('src/**/*.ts')
  }
})

b.default().then((result) => console.log('DONE', result))
