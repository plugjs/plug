import { sep } from 'node:path'
import { logOptions } from './options'
import { AbsolutePath, getCurrentWorkingDirectory, resolveRelativeChildPath } from '../paths'

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

/** Colorize an {@link AbsolutePath}. */
export function $p(path: AbsolutePath): string {
  const directory = getCurrentWorkingDirectory()
  const relative = resolveRelativeChildPath(directory, path)
  const resolved = relative == null ? path : `.${sep}${relative}`
  return _colors ? `${und}${gry}${resolved}${rst}` : `"${resolved}"`
}

/** Colorize a _task name_. */
export function $t(task: string): string {
  return _colors ? `${tsk}${task}${rst}` : `"${task}"`
}

/** Colorize in gray. */
export function $gry(string: any): string {
  return _colors ? `${gry}${string}${rst}` : string
}

/** Colorize in red. */
export function $red(string: any): string {
  return _colors ? `${red}${string}${rst}` : string
}

/** Colorize in green. */
export function $grn(string: any): string {
  return _colors ? `${grn}${string}${rst}` : string
}

/** Colorize in yellow. */
export function $ylw(string: any): string {
  return _colors ? `${ylw}${string}${rst}` : string
}

/** Colorize in blue. */
export function $blu(string: any): string {
  return _colors ? `${blu}${string}${rst}` : string
}

/** Colorize in magenta. */
export function $mgt(string: any): string {
  return _colors ? `${mgt}${string}${rst}` : string
}

/** Colorize in cyan. */
export function $cyn(string: any): string {
  return _colors ? `${cyn}${string}${rst}` : string
}

/** Colorize in white. */
export function $wht(string: any): string {
  return _colors ? `${wht}${string}${rst}` : string
}

/** Underline. */
export function $und(string: any): string {
  return _colors ? `${und}${string}${rst}` : string
}
