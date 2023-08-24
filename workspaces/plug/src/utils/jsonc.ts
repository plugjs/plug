import { EOL } from 'node:os'

import { parse, printParseErrorCode } from 'jsonc-parser'

import { $plur } from '../logging/colors'

import type { ParseError } from 'jsonc-parser'

export interface JsoncOptions {
  disallowComments?: boolean;
  allowTrailingComma?: boolean;
}

export class JsoncError extends Error {
  constructor(public errors: { code: string, line: number, column: number } []) {
    const message = [ `Found ${$plur(errors.length, 'error', 'errors', false)} parsing` ]

    for (const { code, line, column } of errors) {
      message.push(`  ${code} at line ${line}, column ${column}`)
    }

    super(message.join('\n'))
  }
}

export function parseJsonc<T = any>(
    data: string | null | undefined,
    options: JsoncOptions = {},
): T {
  const { disallowComments = false, allowTrailingComma = true } = options

  if (! data) return undefined as T
  const errors: ParseError[] = []
  const result = parse(data, errors, {
    disallowComments,
    allowTrailingComma,
    allowEmptyContent: false,
  })

  if (errors.length === 0) return result

  const offsets = data.split(EOL).reduce(({ offsets, offset }, line) => {
    offset += line.length + EOL.length
    offsets.push(offset)
    return { offsets, offset }
  }, { offset: 0, offsets: [ 0 ] }).offsets

  function resolveOffset(offset: number): { line: number, column: number } {
    for (let i = offsets.length - 1; i > 0; i--) {
      const lineOffset = offsets[i]!
      if (offset < lineOffset) continue
      return { line: i + 1, column: offset - lineOffset + 1 }
    }

    return { line: 1, column: offset + 1 }
  }

  throw new JsoncError(errors.map((error) => {
    const code = printParseErrorCode(error.error)
    return { code, ...resolveOffset(error.offset) }
  }))
}
