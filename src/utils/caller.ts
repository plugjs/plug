import assert from 'assert'
import { statSync } from 'fs'
import { fileURLToPath } from 'url'
import { AbsolutePath, assertAbsolutePath } from '../paths'

export interface Location {
  file: AbsolutePath,
  line?: number | undefined,
  column?: number | undefined,
}

export function findCaller(of: (...args: any[]) => any): Location {
  const oldPrepareStackTrace = Error.prepareStackTrace

  try {
    Error.prepareStackTrace = (_, stackTraces): Location | undefined => {
      const nullableFileOrUrl = stackTraces[0].getFileName()
      if (! nullableFileOrUrl) return

      const nullableLine = stackTraces[0].getColumnNumber()
      const nullableColumn = stackTraces[0].getColumnNumber()

      const line = typeof nullableLine === 'number' ? nullableLine : undefined
      const column = typeof nullableColumn === 'number' ? nullableColumn : undefined

      const file =
        nullableFileOrUrl.startsWith('file:/') ?
          fileURLToPath(nullableFileOrUrl) :
          nullableFileOrUrl

      assertAbsolutePath(file)
      return { file, line, column }
    }

    const record: { stack?: Location } = {}
    Error.captureStackTrace(record, of)
    const location = record.stack

    assert(location, 'Unable to determine build file name')
    assert(statSync(location.file).isFile(), `Build file "${location.file}" not found`)
    return location
  } finally {
    Error.prepareStackTrace = oldPrepareStackTrace
  }
}
