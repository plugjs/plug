import { constants } from 'node:fs'

import fsp from 'node:fs/promises'

type FsPromises = typeof fsp

type FsWrappers = {
  [ K in keyof FsPromises as FsPromises[K] extends ((...args: any[]) => any) ? K : never ]: FsPromises[K]
}

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
  }

  /* Return the "reduced" exports */
  return fs
}, {} as any) as FsWrappers


/* Export all the wrappers to "node:fs/promises" individually */
export const access = fs.access
export const copyFile = fs.copyFile
export const cp = fs.cp
export const open = fs.open
export const opendir = fs.opendir
export const rename = fs.rename
export const truncate = fs.truncate
export const rm = fs.rm
export const rmdir = fs.rmdir
export const mkdir = fs.mkdir
export const readdir = fs.readdir
export const readlink = fs.readlink
export const symlink = fs.symlink
export const lstat = fs.lstat
export const stat = fs.stat
export const link = fs.link
export const unlink = fs.unlink
export const chmod = fs.chmod
export const lchmod = fs.lchmod
export const lchown = fs.lchown
export const chown = fs.chown
export const utimes = fs.utimes
export const lutimes = fs.lutimes
export const realpath = fs.realpath
export const mkdtemp = fs.mkdtemp
export const writeFile = fs.writeFile
export const appendFile = fs.appendFile
export const readFile = fs.readFile
export const watch = fs.watch

/* Export constants from "node:fs" */
export const fsConstants = constants
