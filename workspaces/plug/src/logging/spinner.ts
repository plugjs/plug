/* coverage ignore file */

import { runningTasks } from '../async'
import { $cyn, $gry, $plur, $t } from './colors'
import { logOptions } from './options'

/* ========================================================================== */

/* Clear the current line and set column to zero */
export const zapSpinner = '\u001b[0G\u001b[2K'
/* Disable word wrap (when running lotsa tasks) */
export const disableWrap = '\u001b[?7l'
/* Enable word wrap (after printing lotsa tasks) */
export const enableWrap = '\u001b[?7h'

/* ========================================================================== */

/* Initial value of log colors, and subscribe to changes */
let _output = logOptions.output
let _colors = logOptions.colors
let _format = logOptions.format
let _spinner = logOptions.spinner
let _taskLength = logOptions.taskLength
logOptions.on('changed', ({ output, colors, format, spinner, taskLength }) => {
  _output = output
  _colors = colors
  _format = format
  _spinner = spinner
  _taskLength = taskLength
  setupSpinner()
})

/* ========================================================================== */

/* Spinner characters */
const _spins = [
  $cyn('\u2809'), // ⠉ - 14
  $cyn('\u2819'), // ⠙ - 145
  $cyn('\u2818'), // ⠘ - 45
  $cyn('\u2838'), // ⠸ - 456
  $cyn('\u2830'), // ⠰ - 56
  $cyn('\u2834'), // ⠴ - 356
  $cyn('\u2824'), // ⠤ - 36
  $cyn('\u2826'), // ⠦ - 236
  $cyn('\u2806'), // ⠆ - 23
  $cyn('\u2807'), // ⠇ - 123
  $cyn('\u2803'), // ⠃ - 12
  $cyn('\u280b'), // ⠋ - 124
]

/* The index in our `_spins` */
let _nextSpin = 0
/* The interval running the spinner */
let _interval: NodeJS.Timeout | undefined

/* Spin the spinner! */
function spin(): void {
  if (! _colors) return clearInterval(_interval)
  if (! _spinner) return clearInterval(_interval)

  const tasks = runningTasks()
  if (! tasks.length) return

  const pad = ''.padStart(_taskLength, ' ')
  const names = tasks.map((task) => $t(task)).join($gry(', '))

  const task = $plur(tasks.length, 'task', 'tasks')

  _nextSpin = (++ _nextSpin) % _spins.length

  _output.write(`${zapSpinner}${disableWrap}${pad} ${_spins[_nextSpin]}  Running ${task}: ${$gry(names)}${enableWrap}`)
}

/* Start or stop the spinner */
export function setupSpinner(): void {
  if (_interval) clearInterval(_interval)
  if (_colors && _spinner && (_format === 'fancy')) {
    _interval = setInterval(spin, 150).unref()
  }
}
