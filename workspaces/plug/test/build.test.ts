import { BuildFailure } from '../src/asserts'
import { currentContext, requireContext, runningTasks } from '../src/async'
import { build, invoke } from '../src/build'

describe('Build Invocation', () => {
  it('should invoke a build', async () => {
    let propValue: string | undefined

    const tasks = build({
      myProp: 'this is the default',
      myTask() {
        propValue = this.myProp
      },
    })

    await invoke(tasks, 'myTask')
    expect(propValue).toBe('this is the default')
  })

  it('should invoke a build overriding its properties', async () => {
    let propValue: string | undefined

    const tasks = build({
      myProp: 'this is the default',
      myTask() {
        propValue = this.myProp
      },
    })

    await invoke(tasks, 'myTask', { myProp: 'this is overridden' })
    expect(propValue).toBe('this is overridden')
  })

  it('should merge two builds', async () => {
    const calls: string[] = []

    const tasks1 = build({
      myTask1: () => void calls.push('original myTask1'),
      myTask2: () => void calls.push('original myTask2'),
    })

    const tasks2 = build({
      ...tasks1,
      async myTask2() {
        await this.myTask1()
        void calls.push('overridden myTask2')
      },
    })

    await invoke(tasks2, 'myTask2')
    expect(calls).toEqual([
      'original myTask1', // invoked by overridden task 2
      'overridden myTask2', // calling other build's task 1
    ])
  })

  it('should fail with an invalid task name', async () => {
    const tasks = build({ myTask: () => void 0 })

    await expectAsync(invoke(tasks, 'wrongTask'))
        .toBeRejectedWithError(BuildFailure as any, '')
  })

  it('should fail when a task fails', async () => {
    const tasks = build({ myTask: () => Promise.reject(new Error('Foo!')) })

    await expectAsync(invoke(tasks, 'myTask'))
        .toBeRejectedWithError(BuildFailure as any, '')
  })

  it('should fail with an invalid build', async () => {
    await expectAsync(invoke({}, 'wrongTask'))
        .toBeRejectedWithError(BuildFailure as any, /^$/)
  })

  it('should get the current task context', () => {
    const context1 = currentContext()
    const context2 = requireContext()
    expect(context1).toBe(context2)
    expect(runningTasks()).toContain(context2.taskName)
  })
})
