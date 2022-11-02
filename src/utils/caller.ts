import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { assert } from '../assert'
import { $p } from '../log'
import { assertAbsolutePath } from '../paths'

import type { AbsolutePath } from '../paths'

export function findCaller(of: (...args: any[]) => any): AbsolutePath {
  const oldPrepareStackTrace = Error.prepareStackTrace

  try {
    Error.prepareStackTrace = (_, stackTraces): AbsolutePath | undefined => {
      const [ stackTrace ] = stackTraces
      if (! stackTrace) return

      const nullableFileOrUrl = stackTrace.getFileName()
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
