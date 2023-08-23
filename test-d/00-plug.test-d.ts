import { build, find, invokeTasks, type Files, type Pipe } from '@plugjs/plug'
import { expectAssignable, expectError, expectType, printType } from 'tsd'

printType('__file_marker__')

const tasks = build({
  prop_a: 'prop a',
  prop_b: 'prop b',

  async task_a(): Promise<void> {
    expectAssignable<{
      prop_a: string,
      prop_b: string,
      task_a(): Promise<undefined>,
      task_b(): Pipe,
      task_c(): Pipe,
    }>(this)

    expectError(this.prop_a = 'foo')
    expectError(this.task_a = async (): Promise<void> => {} )
  },

  async task_b(): Promise<Files> {
    expectType<string>(this.prop_a)
    expectType<string>(this.prop_b)
    expectType<() => Promise<undefined>>(this.task_a)
    expectType<() => Pipe>(this.task_b)
    expectType<() => Pipe>(this.task_c)

    expectError(this.missing)

    return await find('')
  },

  task_c: () => find(''),
})

expectAssignable<{
  readonly prop_a: string,
  readonly prop_b: string,
  readonly task_a:() => Promise<undefined>,
  readonly task_b:() => Promise<Files>,
  readonly task_c:() => Promise<Files>,
}>(tasks)

expectType<string>(tasks.prop_a)
expectType<string>(tasks.prop_b)

expectAssignable<() => Promise<undefined>>(tasks.task_a)
expectAssignable<() => Promise<Files>>(tasks.task_b)
expectAssignable<() => Promise<Files>>(tasks.task_c)

expectType<Promise<undefined>>(tasks.task_a())
expectType<Promise<Files>>(tasks.task_b())
expectType<Promise<Files>>(tasks.task_c())

expectError(tasks.prop_a = 'foo')
expectError(tasks.task_a = async (): Promise<void> => {} )
expectError(tasks.missing)

expectType<Promise<void>>(invokeTasks(tasks, [ 'task_a', 'task_b', 'task_c' ], { prop_a: '', prop_b: '' }))
expectType<Promise<void>>(invokeTasks(tasks, [], {}))
expectType<Promise<void>>(invokeTasks(tasks, []))

expectError(invokeTasks(tasks, [ 'missing' ]))
expectError(invokeTasks(tasks, [], { missing: '' }))
expectError(invokeTasks(tasks))
