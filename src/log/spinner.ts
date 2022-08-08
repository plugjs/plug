import { runningTasks } from '../async'

import { $gry, $t } from './colors'
import { logOptions } from './options'

/* ========================================================================== */

/* Clear the current line and set column to zero */
export const zapSpinner = '\u001b[0G\u001b[2K'

/* ========================================================================== */

/* Initial value of log colors, and subscribe to changes */
let _output = logOptions.output
let _colors = logOptions.colors
let _taskLength = logOptions.taskLength
logOptions.on('changed', ({ output, colors, taskLength }) => {
  _output = output
  _colors = colors
  _taskLength = taskLength
  setupSpinner()
})

/* ========================================================================== */

/* Spinner characters */
const _spins = [
  '\u2809', // ⠉ - 14
  '\u2819', // ⠙ - 145
  '\u2818', // ⠘ - 45
  '\u2838', // ⠸ - 456
  '\u2830', // ⠰ - 56
  '\u2834', // ⠴ - 356
  '\u2824', // ⠤ - 36
  '\u2826', // ⠦ - 236
  '\u2806', // ⠆ - 23
  '\u2807', // ⠇ - 123
  '\u2803', // ⠃ - 12
  '\u280b', // ⠋ - 124
]

/* The index in our `_spins` */
let _nextSpin = 0
/* The interval running the spinner */
let _interval: NodeJS.Timer | undefined

/* Spin the spinner! */
function spin(): void {
  if (! _colors) return clearInterval(_interval)

  const tasks = runningTasks()
  if (! tasks.length) return

  const pad = ''.padStart(_taskLength, ' ')
  const names = tasks.map((task) => $t(task)).join($gry(', '))

  const task = tasks.length > 1 ? 'tasks' : 'task'

  _nextSpin = (_nextSpin ++) % _spins.length

  _output.write(`${zapSpinner}${pad} ${_spins[_nextSpin]}  Running ${tasks.length} ${task}: ${$gry(names)}`)
}

/* Start or stop the spinner */
export function setupSpinner(): void {
  if (_interval) clearInterval(_interval)
  if (_colors) _interval = setInterval(spin, 150).unref()
}
