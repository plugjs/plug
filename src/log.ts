import { currentTask } from './async'

export const R = '\u001b[31m' // red
export const G = '\u001b[32m' // green
export const Y = '\u001b[33m' // yellow
export const B = '\u001b[34m' // blue
export const M = '\u001b[35m' // magenta
export const C = '\u001b[36m' // cyan
export const W = '\u001b[37m' // white
export const K = '\u001b[90m' // black-ish
export const U = '\u001b[4m' // underline
export const X = '\u001b[0m' // reset
export const OK = '\u2713'
export const NO = '\u2717'

export interface Log {
  debug: (...data: any[]) => void
  info: (...data: any[]) => void
  warn: (...data: any[]) => void
  error: (...data: any[]) => void
  progress: (...data: any[]) => void
}

export const log: Log = {
  get debug() {
    const task = currentTask()
    return task ? console.debug.bind(undefined, `${K}[${U}${task.name}${X}${K}]${X}`) : console.debug
  },

  get info() {
    const task = currentTask()
    return task ? console.log.bind(undefined, `${K}[${U}${task.name}${X}${K}]${X}`) : console.log
  },

  get warn() {
    const task = currentTask()
    return task ? console.warn.bind(undefined, `${K}[${U}${task.name}${X}${K}]${X}`) : console.warn
  },

  get error() {
    const task = currentTask()
    return task ? console.error.bind(undefined, `${K}[${U}${task.name}${X}${K}]${X}`) : console.error
  },

  get progress() {
    const task = currentTask()
    return task ? console.log.bind(undefined, `${K}[${U}${task.name}${X}${K}]${X}`) : console.log
  }
}
