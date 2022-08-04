import type { Files, FilesBuilder } from './files'
import type { AbsolutePath } from './paths'
import type { Pipe } from './pipe'
import type { FindOptions } from './run'
import type { ParseOptions } from './utils/options'

import { assert, fail } from './assert'
import { currentRun } from './async'

/**
 * Resolve a path into an {@link AbsolutePath}.
 *
 * If the path starts with `@...` it is considered to be relative to the
 * {@link process.cwd | current working directory}, otherwise it will be
 * resolved against the build file where the task was originally defined in.
 */
export function resolve(...paths: string[]): AbsolutePath {
  const run = currentRun()
  assert(run, 'Unable to find files outside a running task')
  return run.resolve(...paths)
}

/**
 * Create a new {@link Files} instance.
 */
export function files(...paths: string[]): FilesBuilder {
  const run = currentRun()
  assert(run, 'Unable to create files builder outside a running task')
  return run.files(...paths)
}

/**
 * Find files according to the globs and {@link FindOptions} specified.
 */
export function find(glob: string, ...args: ParseOptions<FindOptions>): Pipe & Promise<Files> {
  const run = currentRun()
  assert(run, 'Unable to find files outside a running task')
  return run.find(glob, ...args)
}

/** Create a {@link Pipe} from a {@link Files} instance. */
export function pipe(files: Files | Promise<Files>): Pipe & Promise<Files> {
  const run = currentRun()
  assert(run, 'Unable to create pipes outside a running task')
  return run.pipe(files)
}

/** Await for the settlement of all the promises, then return their results. */
export async function parallel<P extends readonly any[]>(...promises: P): Promise<ParallelResult<P>> {
  const settlements = await Promise.allSettled(promises)
  const results: any[] = []

  let errors = 0
  for (const settlement of settlements) {
    if (settlement.status === 'fulfilled') {
      results.push(settlement.value)
      continue
    }

    try {
      fail(settlement.reason)
    } catch (error) {
      // we'll fail below, regardless
    } finally {
      errors ++
    }
  }

  if (errors) fail('Parallel execution failed for', errors, 'tasks')
  return results as ParallelResult<P>
}

type ParallelResult<T extends readonly any[]> =
  T extends readonly [ infer First, ...infer Rest ] ?
    [ Awaited<First>, ...ParallelResult<Rest> ] :
  T extends readonly [ infer Only ] ?
    [ Awaited<Only> ] :
  T extends readonly [] ?
    [] :
  never
