import { join } from 'node:path'

import { BuildFailure } from '../src/asserts'
import { requireContext } from '../src/async'
import { Files } from '../src/files'
import { noop, plugjs } from '../src/index'
import { getCurrentWorkingDirectory, resolveAbsolutePath } from '../src/paths'
import { Context, PipeImpl, install } from '../src/pipe'

import type { Plug } from '../src/pipe'

describe('Pipes and Context', () => {
  const { taskName } = requireContext()

  it('should correctly resolve files in a context', () => {
    const cwd = getCurrentWorkingDirectory()
    const file = resolveAbsolutePath(cwd, 'subdir', 'build.ts')
    const context = new Context(file, taskName)

    expect(context.resolve('')).toStrictlyEqual(process.cwd())
    expect(context.resolve('.')).toStrictlyEqual(process.cwd())
    expect(context.resolve('@')).toStrictlyEqual(join(process.cwd(), 'subdir'))

    expect(context.resolve('foobar')).toStrictlyEqual(join(process.cwd(), 'foobar'))
    expect(context.resolve('./foobar')).toStrictlyEqual(join(process.cwd(), 'foobar'))
    expect(context.resolve('../foobar')).toStrictlyEqual(join(process.cwd(), '..', 'foobar'))
    expect(context.resolve('foobar', 'baz')).toStrictlyEqual(join(process.cwd(), 'foobar', 'baz'))
    expect(context.resolve('./foobar', 'baz')).toStrictlyEqual(join(process.cwd(), 'foobar', 'baz'))
    expect(context.resolve('../foobar', 'baz')).toStrictlyEqual(join(process.cwd(), '..', 'foobar', 'baz'))

    expect(context.resolve('@foobar')).toStrictlyEqual(join(process.cwd(), 'subdir', 'foobar'))
    expect(context.resolve('@/foobar')).toStrictlyEqual(join(process.cwd(), 'subdir', 'foobar'))
    expect(context.resolve('@foobar', 'baz')).toStrictlyEqual(join(process.cwd(), 'subdir', 'foobar', 'baz'))
    expect(context.resolve('@/foobar', 'baz')).toStrictlyEqual(join(process.cwd(), 'subdir', 'foobar', 'baz'))
  })

  it('should await a fullfilled pipe', async () => {
    const files = new Files(getCurrentWorkingDirectory())
    const pipe = new PipeImpl(requireContext(), Promise.resolve(files))
    const calls: string[] = []

    await pipe
        .then((result) => {
          calls.push('then ok')
          expect(result).toStrictlyEqual(files)
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
          expect(error.message).toStrictlyEqual('foo')
        })
        .catch(() => Promise.reject(new Error('then')))

    await pipe
        .catch((error) => {
          calls.push('catch')
          expect(error.message).toStrictlyEqual('foo')
        })
        .catch(() => Promise.reject(new Error('catch')))

    await pipe
        .finally(() => {
          calls.push('finally')
        })
        // remember, finally re-throws :)
        .catch((error) => {
          expect(error.message).toStrictlyEqual('foo')
        })

    expect(calls).toEqual([ 'then no', 'catch', 'finally' ])
  })

  it('should use plugs and functions', async () => {
    const files = new Files(getCurrentWorkingDirectory())
    const pipe = new PipeImpl(requireContext(), Promise.resolve(files))

    const calls: string[] = []

    const result = await pipe
        .plug((result, context) => {
          calls.push('function')
          expect(result).toStrictlyEqual(files)
          expect(context).toStrictlyEqual(requireContext())
          return result
        })
        .plug(new class implements Plug<Files> {
          pipe(result: Files, context: Context): Files | Promise<Files> {
            calls.push('class')
            expect(result).toStrictlyEqual(files)
            expect(context).toStrictlyEqual(requireContext())
            return result
          }
        })

    expect(result).toStrictlyEqual(files)
    expect(calls).toEqual([ 'function', 'class' ])
  })

  it('should install a plug', async () => {
    let options: any[] | undefined = undefined

    class MyPlug implements Plug<void> {
      private _options: any[]
      constructor(...options: any[]) {
        this._options = options
      }
      pipe(files: Files, context: Context): void {
        void files, context
        options = this._options
      }
    }

    const tasks = plugjs({
      async _test1() {
        const pipe1 = noop()
        expect((<any> pipe1).__my_plug__).toBeUndefined()
      },

      async _test2() {
        const pipe2 = noop()
        expect((<any> pipe2).__my_plug__).toBeInstanceOf(Function)

        await (<any> pipe2).__my_plug__('foo', 123, { a: true })
      },
    })

    await tasks._test1()
    install('__my_plug__' as any, MyPlug as any)
    await tasks._test2()
    expect(options).toEqual([ 'foo', 123, { a: true } ] as any)
  })

  it('should not extend a pipe when returning undefined', async () => {
    const files = new Files(getCurrentWorkingDirectory())
    const pipe = new PipeImpl(requireContext(), Promise.resolve(files))

    const calls: string[] = []

    const promise = pipe
        .plug((result, context) => {
          calls.push('downgrade')
          expect(result).toStrictlyEqual(files)
          expect(context).toStrictlyEqual(requireContext())
          return undefined as any as Files
        })
        .plug(() => {
          throw new Error('No way, Jose!')
        })

    await expect(promise).toBeRejectedWithError(BuildFailure as any, 'Unable to extend pipe')
    expect(calls).toEqual([ 'downgrade' ])
  })
})
