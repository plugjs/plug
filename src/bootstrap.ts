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
    await sleep(1000)
    log.info('Hello, compile 2!')
    return this.find('**/*.ts', { directory: 'src' })
  },
  async runme() {
    log.info('Hello, runme 1!')
    await sleep(1500)
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

// console.log('[taskname] \u001b[48;5;196;38;5;16m ERROR \u001b[0m An error message')
// console.log('[taskname] \u001b[48;5;196;38;5;16m ERROR \u001b[0m An error message')
// console.log('[taskname] \u001b[48;5;196;38;5;16m ERROR \u001b[0m An error message')
// console.log('[taskname] \u001b[48;5;196;38;5;16m ERROR \u001b[0m An error message')
// console.log('[taskname] \u001b[48;5;196;38;5;16m ERROR \u001b[0m An error message')

// console.log('[taskname] \u001b[48;5;226;38;5;16m WARNING \u001b[0m An error message')
// console.log('[taskname] \u001b[48;5;226;38;5;16m WARNING \u001b[0m An error message')
// console.log('[taskname] \u001b[48;5;226;38;5;16m WARNING \u001b[0m An error message')
// console.log('[taskname] \u001b[48;5;226;38;5;16m WARNING \u001b[0m An error message')
// console.log('[taskname] \u001b[48;5;226;38;5;16m WARNING \u001b[0m An error message')

// console.log('[taskname] \u001b[48;5;105;38;5;16m DEBUG \u001b[0m An error message')
// console.log('[taskname] \u001b[48;5;105;38;5;16m DEBUG \u001b[0m An error message')
// console.log('[taskname] \u001b[48;5;105;38;5;16m DEBUG \u001b[0m An error message')
// console.log('[taskname] \u001b[48;5;105;38;5;16m DEBUG \u001b[0m An error message')
// console.log('[taskname] \u001b[48;5;105;38;5;16m DEBUG \u001b[0m An error message')

// const colors: string[] = []

// for (let r = 0; r < 6; r++) {
//   for (let g = 0; g < 6; g++) {
//     for (let b = 0; b < 6; b++) {
//       const col = (r * 36) + (g * 6) + b + 16
//       if ((r + g + b) < 9) continue
//       if ((r + g + b) > 12) continue
//       colors.push(`\u001b[38;5;${col}m`)
//     }
//   }
// }

// colors.sort(() => Math.floor(Math.random() * 2) || -1)

// for (const col of colors) {
//   console.log(`${col}[taskname]\u001b[0m`)
// }

// console.log(colors, colors.length)
