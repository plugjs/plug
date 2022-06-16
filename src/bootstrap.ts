import { build } from './build'
import { log, LogLevel } from './log'
import { Pipe } from './pipe'
// import { from } from './task'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

const b = build({
  async compile() {
    log.info('Hello, compile 1!')
    await sleep(2000)
    log.info('Hello, compile 2!')
    return this.find('**/*.ts', { directory: 'src' })
  },
  async runme() {
    log.info('Hello, runme 1!')
    await sleep(1000)
    log.info('Hello, runme 2!')
    return this.find('types/**/*.ts')
    // this.call('compile')
  },
  default(): Pipe {
    return (<any> this).parallel('compile', 'boasdfasd' , 'runme')
    // return this.find('src/**/*.ts')
  }
})

log.logLevel = LogLevel.DEBUG

b.default()
  .then((result) => console.log('DONE', result))
  .catch((error) => console.error(error))
