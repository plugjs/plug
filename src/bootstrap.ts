import { Files } from './files'
import { build } from './build'
import { log } from './log'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function fff() {
  log.info('Hello, compile XXX!')
}

const q = fff.bind(undefined)

const b = build({
  async compile() {
    console.log(await this.find({
      directory: '.',
    }))

    setTimeout(q, 1500)
    log.info('Hello, compile 1!')
    await sleep(2000)
    log.info('Hello, compile 2!')
    // return this.find('**/*.ts', { directory: 'src' })
  },
  async runme() {
    log.info('Hello, runme 1!')
    await sleep(1000)
    log.info('Hello, runme 2!')
    // return this.find('types/**/*.ts')
    throw new Error('Foo')
    // this.call('compile')
  },
  async default(): Promise<Files> {
    const pipe = await this.parallel('compile' , 'runme')
    log.info('PIPE AWAITED')
    return pipe
  }
})

// log.logLevel = LogLevel.DEBUG

b.default()
  .then((result) => console.log('DONE', result))
  .catch((error) => console.error(error))
