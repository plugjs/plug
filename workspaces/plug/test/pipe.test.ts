import { join } from 'node:path'

import { requireContext } from '../src/async'
import { getCurrentWorkingDirectory, resolveAbsolutePath } from '../src/paths'
import { Context, PipeImpl } from '../src/pipe'
import { Files } from '../src/files'
import { BuildFailure } from '../src/asserts'

import type { Plug } from '../src/pipe'

describe('Pipes and Context', () => {
  const { taskName } = requireContext()

  it('should correctly resolve files in a context', () => {
    const cwd = getCurrentWorkingDirectory()
    const file = resolveAbsolutePath(cwd, 'subdir', 'build.ts')
    const context = new Context(file, taskName)

    expect(context.resolve('')).toBe(process.cwd())
    expect(context.resolve('.')).toBe(process.cwd())
    expect(context.resolve('@')).toBe(join(process.cwd(), 'subdir'))

    expect(context.resolve('foobar')).toBe(join(process.cwd(), 'foobar'))
    expect(context.resolve('./foobar')).toBe(join(process.cwd(), 'foobar'))
    expect(context.resolve('../foobar')).toBe(join(process.cwd(), '..', 'foobar'))
    expect(context.resolve('foobar', 'baz')).toBe(join(process.cwd(), 'foobar', 'baz'))
    expect(context.resolve('./foobar', 'baz')).toBe(join(process.cwd(), 'foobar', 'baz'))
    expect(context.resolve('../foobar', 'baz')).toBe(join(process.cwd(), '..', 'foobar', 'baz'))

    expect(context.resolve('@foobar')).toBe(join(process.cwd(), 'subdir', 'foobar'))
    expect(context.resolve('@/foobar')).toBe(join(process.cwd(), 'subdir', 'foobar'))
    expect(context.resolve('@foobar', 'baz')).toBe(join(process.cwd(), 'subdir', 'foobar', 'baz'))
    expect(context.resolve('@/foobar', 'baz')).toBe(join(process.cwd(), 'subdir', 'foobar', 'baz'))
  })

  it('should await a fullfilled pipe', async () => {
    const files = new Files(getCurrentWorkingDirectory())
    const pipe = new PipeImpl(requireContext(), Promise.resolve(files))
    const calls: string[] = []

    await pipe
        .then((result) => {
          calls.push('then ok')
          expect(result).toBe(files)
        }, (error) => {
          calls.push('then no')
          throw error
        })
        .catch(() => Promise.reject(new Error('then')))

    await pipe
        .catch((error) => {
          calls.push('catch')
          throw error
        })
        .catch(() => Promise.reject(new Error('catch')))

    await pipe
        .finally(() => {
          calls.push('finally')
        })

    expect(calls).toEqual([ 'then ok', 'finally' ])
  })

  it('should await a rejected pipe', async () => {
    const pipe = new PipeImpl(requireContext(), Promise.reject(new Error('foo')))
    const calls: string[] = []

    await pipe
        .then(() => {
          throw new Error('then ok')
        }, (error) => {
          calls.push('then no')
          expect(error.message).toBe('foo')
        })
        .catch(() => Promise.reject(new Error('then')))

    await pipe
        .catch((error) => {
          calls.push('catch')
          expect(error.message).toBe('foo')
        })
        .catch(() => Promise.reject(new Error('catch')))

    await pipe
        .finally(() => {
          calls.push('finally')
        })
        // remember, finally re-throws :)
        .catch((error) => {
          expect(error.message).toBe('foo')
        })

    expect(calls).toEqual([ 'then no', 'catch', 'finally' ])
  })

  it('should install plugs and functions', async () => {
    const files = new Files(getCurrentWorkingDirectory())
    const pipe = new PipeImpl(requireContext(), Promise.resolve(files))

    const calls: string[] = []

    const result = await pipe
        .plug((result, context) => {
          calls.push('function')
          expect(result).toBe(files)
          expect(context).toBe(requireContext())
          return result
        })
        .plug(new class implements Plug<Files> {
          pipe(result: Files, context: Context): Files | Promise<Files> {
            calls.push('class')
            expect(result).toBe(files)
            expect(context).toBe(requireContext())
            return result
          }
        })

    expect(result).toBe(files)
    expect(calls).toEqual([ 'function', 'class' ])
  })

  it('should not extend a pipe when returning undefined', async () => {
    const files = new Files(getCurrentWorkingDirectory())
    const pipe = new PipeImpl(requireContext(), Promise.resolve(files))

    const calls: string[] = []

    const promise = pipe
        .plug((result, context) => {
          calls.push('downgrade')
          expect(result).toBe(files)
          expect(context).toBe(requireContext())
          return undefined as any as Files
        })
        .plug(() => {
          throw new Error('No way, Jose!')
        })

    await expectAsync(promise).toBeRejectedWithError(BuildFailure as any, 'Unable to extend pipe')
    expect(calls).toEqual([ 'downgrade' ])
  })
})
