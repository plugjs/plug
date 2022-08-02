import type { AbsolutePath } from './paths'
import type { Files } from './files'
import type { FindOptions } from './run'
import type { ParseOptions } from './utils/options'

import { Pipe } from './pipe'
import { assert, assertSettled } from './assert'
import { currentRun } from './async'

/**
 * Find files according to the globs and {@link FindOptions} specified.
 */
export function find(glob: string, ...args: ParseOptions<FindOptions>): Pipe {
  const run = currentRun()
  assert(run, 'Unable to find files outside a running task')
  return run.find(glob, ...args)
}

/**
 * Resolve a path into an {@link AbsolutePath}.
 *
 * If the path starts with `@...` it is considered to be relative to this
 * instance's `baseDir`, otherwise it will be resolved against the build file
 * where the task was _originally_ defined in.
 */
export function resolve(...paths: string[]): AbsolutePath {
  const run = currentRun()
  assert(run, 'Unable to find files outside a running task')
  return run.resolve(...paths)
}

/** Create a {@link Pipe} from a {@link Files} instance. */
export function pipe(files: Files | Promise<Files>): Pipe {
  const run = currentRun()
  assert(run, 'Unable to create pipes outside a running task')
  return new Pipe(Promise.resolve().then(() => files), run)
}

/** Await for the settlement of all the promises, then return their results. */
export async function parallel<P extends readonly any[]>(...promises: P): Promise<ParallelResult<P>> {
  const settlements = await Promise.allSettled(promises)
  assertSettled(settlements, 'Parallel execution failed')
  return settlements.map((r) => {
    assert(r.status === 'fulfilled', 'Promise not fullfilled') // WHY OH WHY???
    return r.value
  }) as ParallelResult<P>
}

type ParallelResult<T extends readonly any[]> =
  T extends readonly [ infer First, ...infer Rest ] ?
    [ Awaited<First>, ...ParallelResult<Rest> ] :
  T extends readonly [ infer Only ] ?
    [ Awaited<Only> ] :
  T extends readonly [] ?
    [] :
  never
