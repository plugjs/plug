import { sep } from 'node:path'

import { getCurrentWorkingDirectory, resolveRelativeChildPath } from '../paths'
import { logOptions } from './options'

import type { AbsolutePath } from '../paths'

/* ========================================================================== */

/* Initial value of log colors, and subscribe to changes */
let _colors = logOptions.colors
logOptions.on('changed', ({ colors }) => _colors = colors)

/* ========================================================================== *
 * PRETTY COLORS                                                              *
 * ========================================================================== */

const rst = '\u001b[0m' // reset all colors to default

const und = '\u001b[4m' // underline on

const gry = '\u001b[38;5;240m' // somewhat gray
const red = '\u001b[38;5;203m' // light red (Leo's favorite)
const grn = '\u001b[38;5;76m' // greenish
const ylw = '\u001b[38;5;220m' // yellow
const blu = '\u001b[38;5;69m' // brighter blue
const mgt = '\u001b[38;5;213m' // pinky magenta
const cyn = '\u001b[38;5;81m' // darker cyan
const wht = '\u001b[1;38;5;255m' // full-bright white

const tsk = '\u001b[38;5;141m' // the color for tasks (purple)

/* ========================================================================== */

function colorize(color: string, string: any): string {
  if (! _colors) return `${string}`
  const lines = `${string}`.split('\n')
  return lines.map((line) => `${color}${line}${rst}`).join('\n')
}

/** Colorize an {@link AbsolutePath}. */
export function $p(path: AbsolutePath): string {
  const directory = getCurrentWorkingDirectory()
  const relative = resolveRelativeChildPath(directory, path)
  const resolved = relative == null ? path : `.${sep}${relative}`
  return _colors ? `${und}${gry}${resolved}${rst}` : `"${resolved}"`
}

/** Colorize a _task name_. */
export function $t(task: string, quoted = true): string {
  return _colors ? `${tsk}${task}${rst}` : quoted ? `"${task}"` : task
}

/** Colorize milliseconds. */
export function $ms(millis: number, note?: string): string {
  let string: string
  if (millis >= 60000) {
    // One minute or more: style is Xm Ys
    const minutes = Math.floor(millis / 60000)
    const seconds = Math.floor((millis % 60000) / 1000)
    string = `${minutes}m ${seconds}s`
  } else if (millis >= 10000) {
    // Ten seconds or more: style is 12.3s
    const seconds = Math.floor(millis / 1000)
    const decimal = Math.floor(millis % 1000 / 100)
    string = `${seconds}.${decimal}s`
  } else if (millis >= 1000) {
    // One second or more: style is 1.23s
    const seconds = Math.floor(millis / 1000)
    const decimal = Math.floor(millis % 1000 / 10)
    string = `${seconds}.${decimal}s`
  } else {
    // Milliseconds: style is 123ms
    string = `${millis}ms`
  }
  if (note) string = `${note} ${string}`
  return _colors ? `${gry}[${string}]${rst}` : `[${string}]`
}

/** Colorize in gray. */
export function $gry(string: any): string {
  return _colors ? `${gry}${string}${rst}` : string
}

/** Colorize in red. */
export function $red(string: any): string {
  return colorize(red, string)
}

/** Colorize in green. */
export function $grn(string: any): string {
  return colorize(grn, string)
}

/** Colorize in yellow. */
export function $ylw(string: any): string {
  return colorize(ylw, string)
}

/** Colorize in blue. */
export function $blu(string: any): string {
  return colorize(blu, string)
}

/** Colorize in magenta. */
export function $mgt(string: any): string {
  return colorize(mgt, string)
}

/** Colorize in cyan. */
export function $cyn(string: any): string {
  return colorize(cyn, string)
}

/** Colorize in white. */
export function $wht(string: any): string {
  return colorize(wht, string)
}

/** Underline. */
export function $und(string: any): string {
  return colorize(und, string)
}
