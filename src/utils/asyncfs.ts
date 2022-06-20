import fsp from 'node:fs/promises'
import { constants } from 'node:fs'

/*
 * I have no idea why sometimes stacks don't have a trace when coming out of
 * the "node:fs/promises" api... There is a _stack_ property on the object
 * but it simply includes the first line (if so), no thing further...
 *
 * Upon further inspection, it _seems_ this is related to some issues with the
 * Error.captureStackTrace(...) function. If we pass a function to it as
 * second parameter in our functions below, we end up with no stacks as well!
 *
 * So, for now, let's catch all errors, invoke `Error.captureStackTrace`
 * manually without any parameter (besides the error itself), and fail with
 * this.
 *
 * Hopefully, it'll get fixed, eventually, but for now let's keep this wrapper
 * around!
 */

/* Process every entry in "node:fs/promises" */
const fs = Object.entries(fsp as any).reduce((fs, [ key, val ]) => {
  if (typeof val === 'function') {
    /* If the value is a function, wrap it! */
    const f = function(...args: any[]): any {
      /* Call the function, and _catch_ any error */
      return val.apply(fsp, args).catch((error: any) => {
        /* For any error caught, we fill in the stack trace */
        Error.captureStackTrace(error)
        throw error
      })
    }

    /* Make sure that the functions are called correctly */
    Object.defineProperty(f, 'name', { value: key })
    /* Assign the wrapper to our exports */
    fs[key] = f
  } else {
    /* Not a function, no wrapping... */
    fs[key] = val
  }

  /* Return the "reduced" exports */
  return fs
}, { constants } as any) as typeof fsp & { constants: typeof constants }

/* Export _our_ version of the "node:fs/promises" module */
export default fs
