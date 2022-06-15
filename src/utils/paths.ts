import { existsSync } from 'node:fs'

// This is a bit of a hack: we determine case sensitivity on _this_ file
// but maybe a Files from another directory might use a different
// underlying filesystem... This is good enough for now!
const __lfilename = __filename.toLowerCase()
const __ufilename = __filename.toUpperCase()

/** The flag indicating whether the file system support case sensitivity */
export const caseSensitivePaths = !(existsSync(__lfilename) && existsSync(__ufilename))
