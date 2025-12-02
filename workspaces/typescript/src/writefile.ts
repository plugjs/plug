import { $p } from '@plugjs/plug'
import { resolveAbsolutePath } from '@plugjs/plug/paths'
import ts from 'typescript'

import type { FilesBuilder } from '@plugjs/plug/files'
import type { Context } from '@plugjs/plug/pipe'

/** Write a file (using `ts.sys.writeFile`) and add it to the builder */
export function buildWriteFile(
    builder: FilesBuilder,
    context: Context,
): ts.WriteFileCallback {
  return function writeFile(
      fileName: string,
      code: string,
      writeBOM: boolean,
      onError?: (message: string) => void,
  ): void {
    const outFile = resolveAbsolutePath(builder.directory, fileName)
    /* coverage ignore catch */
    try {
      ts.sys.writeFile(outFile, code, writeBOM)
      builder.add(outFile)
    } catch (error: any) {
      context.log.error('Error writing to', $p(outFile), error)
      if (onError && error.message) onError(error.message)
      throw error
    }
  }
}
