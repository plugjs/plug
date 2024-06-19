import { Files } from '@plugjs/plug'

import { currentContext, requireContext, runningTasks } from '../src/async'
import { BuildFailure } from '../src/asserts'
import { hookAfter, hookBefore, invokeTasks, isBuild, plugjs } from '../src/build'

describe('Build Invocation', () => {
  it('should invoke a build', async () => {
    let propValue: string | undefined

    const tasks = plugjs({
      myProp: 'this is the default',
      _myTask() {
        propValue = this.myProp
      },
    })

    expect(isBuild(tasks)).toStrictlyEqual(true)
    await invokeTasks(tasks, [ '_myTask' ])
    expect(propValue).toStrictlyEqual('this is the default')

    // task as a function
    propValue = 'wrong'
    await tasks._myTask()
    expect(propValue).toStrictlyEqual('this is the default')
  })

  it('should invoke a build overriding its properties', async () => {
    let propValue: string | undefined

    const tasks = plugjs({
      myProp: 'this is the default',
      _myTask() {
        propValue = this.myProp
      },
    })

    await invokeTasks(tasks, [ '_myTask' ], { myProp: 'this is overridden' })
    expect(propValue).toStrictlyEqual('this is overridden')

    // task as a function
    propValue = 'wrong'
    await tasks._myTask({ myProp: 'this is overridden' })
    expect(propValue).toStrictlyEqual('this is overridden')
  })

  it('should return the correct types invoking tasks', async () => {
    const tasks = plugjs({
      _void: () => void 0,
      _files: () => new Files(),
    })

    expect(await invokeTasks(tasks, [ '_files', '_void' ])).toBeUndefined()
    expect(await invokeTasks(tasks, [ '_void' ])).toBeUndefined()
    expect(await invokeTasks(tasks, [ '_files' ])).toBeUndefined()
    expect(await tasks._void()).toBeUndefined()
    expect(await tasks._files()).toBeInstanceOf(Files)
  })

  it('should cache the output of a task', async () => {
    let cachedCalls = 0
    let firstCalls = 0
    let secondCalls = 0
    let defaultCalls = 0

    const tasks = plugjs({
      _cached() {
        cachedCalls ++
      },
      async _first() {
        await this._cached()
        firstCalls ++
      },
      async _second() {
        await this._cached()
        secondCalls ++
      },
      async _default() {
        await this._first()
        await this._second()
        defaultCalls ++
      },
    })

    await tasks._default()
    expect(cachedCalls).toEqual(1)
    expect(firstCalls).toEqual(1)
    expect(secondCalls).toEqual(1)
    expect(defaultCalls).toEqual(1)
  })

  it('should merge two builds', async () => {
    const calls: string[] = []

    const tasks1 = plugjs({
      _myTask1: () => void calls.push('original myTask1'),
      _myTask2: () => void calls.push('original myTask2'),
    })

    const tasks2 = plugjs({
      ...tasks1,
      async _myTask2() {
        await this._myTask1()
        void calls.push('overridden myTask2')
      },
    })

    await tasks2._myTask2()
    expect(calls).toEqual([
      'original myTask1', // invoked by overridden task 2
      'overridden myTask2', // calling other build's task 1
    ])
  })

  it('should override a task', async () => {
    const calls: string[] = []

    const tasks1 = plugjs({
      async _caller() {
        calls.push('from the caller invoking the callee')
        await this._callee()
      },
      _callee() {
        void calls.push('from the callee')
      },
    })

    const tasks2 = plugjs({
      ...tasks1,
      async _callee() {
        void calls.push('from the overridden callee')
      },
      async _master() {
        // void calls.push('from the overridden callee')
      },
    })

    await invokeTasks(tasks2, [ '_caller' ])
    expect(calls).toEqual([
      'from the caller invoking the callee',
      'from the overridden callee',
    ])

    calls.splice(0)
    await tasks2._caller()
    expect(calls).toEqual([
      'from the caller invoking the callee',
      'from the overridden callee',
    ])
  })

  it('should hook tasks before and after one another', async () => {
    const calls: string[] = []
    let taskCalls = 0
    let before1Calls = 0
    let before2Calls = 0
    let before3Calls = 0
    let after1Calls = 0
    let after2Calls = 0
    let after3Calls = 0

    const tasks = plugjs({
      _task: () => void (taskCalls ++, calls.push('_task')),
      _before1: () => void (before1Calls ++, calls.push('_before1')),
      _before2: () => void (before2Calls ++, calls.push('_before2')),
      _before3: () => void (before3Calls ++, calls.push('_before3')),
      _after1: () => void (after1Calls ++, calls.push('_after1')),
      _after2: () => void (after2Calls ++, calls.push('_after2')),
      _after3: () => void (after3Calls ++, calls.push('_after3')),
    })

    hookBefore(tasks, '_task', [ '_before1', '_before2', '_before3' ])
    hookBefore(tasks, '_before3', [ '_before2' ])
    hookBefore(tasks, '_before2', [ '_before1' ])
    hookAfter(tasks, '_task', [ '_after1', '_after2', '_after3' ])
    hookAfter(tasks, '_after1', [ '_after2' ])
    hookAfter(tasks, '_after2', [ '_after3' ])

    await tasks._task()

    expect(before1Calls).toEqual(1)
    expect(before2Calls).toEqual(1)
    expect(before3Calls).toEqual(1)
    expect(taskCalls).toEqual(1)
    expect(after1Calls).toEqual(1)
    expect(after2Calls).toEqual(1)
    expect(after3Calls).toEqual(1)

    expect(calls).toEqual([
      '_before1',
      '_before2',
      '_before3',
      '_task',
      '_after1',
      '_after2',
      '_after3',
    ])
  })

  it('should fail with an invalid task name', async () => {
    const tasks = plugjs({ myTask: () => void 0 })

    await expect(invokeTasks(tasks, [ 'wrongTask' as any ]))
        .toBeRejectedWithError(BuildFailure, '')
  })

  it('should fail when a task fails', async () => {
    const tasks = plugjs({ myTask: () => Promise.reject(new Error('Foo!')) })

    await expect(invokeTasks(tasks, [ 'myTask' ]))
        .toBeRejectedWithError(BuildFailure, '')
  })

  it('should detect recursion between tasks', async () => {
    const tasks = plugjs({
      async task1() {
        void await this.task2()
      },
      async task2() {
        void await this.task3()
      },
      async task3() {
        void await this.task1()
      },
    })

    await expect(invokeTasks(tasks, [ 'task1' ]))
        .toBeRejectedWithError(BuildFailure, '')
  })

  it('should fail and not run a task when a before hook fails', async () => {
    let taskCalls = 0

    const tasks = plugjs({
      hook: () => Promise.reject(new Error('Nope!')),
      task: () => void taskCalls++,
    })

    hookBefore(tasks, 'task', [ 'hook' ])

    await expect(tasks.task())
        .toBeRejectedWithError(BuildFailure)
    expect(taskCalls).toEqual(0)
  })

  it('should run a task then fail when an after hook fails', async () => {
    let taskCalls = 0
    let defaultCalls = 0

    const tasks = plugjs({
      hook: () => Promise.reject(new Error('Nope!')),
      task: () => void taskCalls++,
      async default() {
        await this.task()
        defaultCalls ++
      },
    })

    hookAfter(tasks, 'task', [ 'hook' ])

    await expect(tasks.default())
        .toBeRejectedWithError(BuildFailure)
    expect(taskCalls).toEqual(1)
    expect(defaultCalls).toEqual(0)
  })

  it('should detect recursion between before hooks', async () => {
    const tasks = plugjs({
      _task1: () => void 0,
      _task2: () => void 0,
      _task3: () => void 0,
    })

    hookBefore(tasks, '_task1', [ '_task2', '_task2', '_task2' ])
    hookBefore(tasks, '_task2', [ '_task3' ])
    hookBefore(tasks, '_task3', [ '_task1' ])

    await expect(tasks._task1())
        .toBeRejectedWithError(BuildFailure, '')
  })

  it('should detect recursion between after hooks', async () => {
    const tasks = plugjs({
      _task1: () => void 0,
      _task2: () => void 0,
      _task3: () => void 0,
    })

    hookAfter(tasks, '_task1', [ '_task2', '_task2', '_task2' ])
    hookAfter(tasks, '_task2', [ '_task3' ])
    hookAfter(tasks, '_task3', [ '_task1' ])

    await expect(tasks._task1())
        .toBeRejectedWithError(BuildFailure, '')
  })

  it('should get the current task context', () => {
    const context1 = currentContext()
    const context2 = requireContext()
    expect(context1).toStrictlyEqual(context2)
    expect(runningTasks()).toInclude([ context2.taskName ])
  })

  it('should fail invoking when the build is not a build', () => {
    expect(isBuild({})).toStrictlyEqual(false)
    expect(() => invokeTasks({} as any, [ '_myTask' ]))
        .toThrowError(TypeError, 'Invalid build instance')
  })
})
