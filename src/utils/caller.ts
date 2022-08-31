import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assert } from '../assert'
import { $p } from '../log'
import { AbsolutePath, assertAbsolutePath } from '../paths'

export function findCaller(of: (...args: any[]) => any): AbsolutePath {
  const oldPrepareStackTrace = Error.prepareStackTrace

  try {
    Error.prepareStackTrace = (_, stackTraces): AbsolutePath | undefined => {
      const nullableFileOrUrl = stackTraces[0].getFileName()
      if (! nullableFileOrUrl) return

      const file =
        nullableFileOrUrl.startsWith('file:/') ?
          fileURLToPath(nullableFileOrUrl) :
          nullableFileOrUrl

      assertAbsolutePath(file)
      return file
    }

    const record: { stack?: AbsolutePath } = {}
    Error.captureStackTrace(record, of)
    const file = record.stack

    assert(file, 'Unable to determine build file name')
    assert(statSync(file).isFile(), `Build file ${$p(file)} not found`)
    return file
  } finally {
    Error.prepareStackTrace = oldPrepareStackTrace
  }
}
