import { EOL } from 'node:os'
import { formatWithOptions } from 'node:util'

import { stripAnsi } from '../utils/ansi'
import { logOptions } from './options'

import type { AbsolutePath } from '../paths'

/* Initial values, and subscribe to changes */
let _output = logOptions.output
let _githubAnnotations = logOptions.githubAnnotations
let _inspectOptions = { ...logOptions.inspectOptions, breakLength: Infinity }
logOptions.on('changed', (options) => {
  _output = options.output
  _githubAnnotations = options.githubAnnotations
  _inspectOptions = { ...options.inspectOptions, breakLength: Infinity }
})


function escapeData(data: string): string {
  return stripAnsi(data)
      .replace(/%/g, '%25')
      .replace(/\r/g, '%0D')
      .replace(/\n/g, '%0A')
}

function escapeProp(prop: string | number): string {
  return stripAnsi(`${prop}`)
      .replace(/%/g, '%25')
      .replace(/\r/g, '%0D')
      .replace(/\n/g, '%0A')
      .replace(/:/g, '%3A')
      .replace(/,/g, '%2C')
}

export type GithubAnnotationType = 'warning' | 'error'

export interface GithubAnnotationOptions {
  type: GithubAnnotationType
  title?: string
  file?: AbsolutePath
  line?: number
  endLine?: number
  col?: number
  endColumn?: number
}

export function githubAnnotation(type: GithubAnnotationType, message: string, ...args: any[]): void
export function githubAnnotation(options: GithubAnnotationOptions, message: string, ...args: any[]): void

export function githubAnnotation(options: GithubAnnotationType | GithubAnnotationOptions, ...args: any[]): void {
  if (! _githubAnnotations) return

  if (typeof options === 'string') options = { type: options }
  const { type, ...parameters } = options

  const attributes = Object.entries(parameters)
      .filter(([ key, value ]) => !!(key && value))
      .map(([ key, value ]) => `${key}=${escapeProp(value)}`)
      .join(',')

  const msg = escapeData(formatWithOptions(_inspectOptions, ...args))

  if (attributes) {
    _output.write(`::${type} ${attributes}::${msg}${EOL}`)
  } else {
    _output.write(`::${type}::${msg}${EOL}`)
  }
}
