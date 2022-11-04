import { expect } from 'chai'

import { BuildFailure } from '../src/asserts'
import { currentContext, requireContext, runningTasks } from '../src/async'
import { build, invoke } from '../src/build'
import { log } from '../src/index'

describe('Build Invocation', () => {
  it('should invoke a build', async () => {
    let propValue: string | undefined

    const tasks = build({
      myProp: 'this is the default',
      myTask() {
        propValue = this.myProp
      },
    })

    log('Starting test build')
    await invoke(tasks, 'myTask')
    expect(propValue).to.equal('this is the default')
  })

  it('should invoke a build overriding its properties', async () => {
    let propValue: string | undefined

    const tasks = build({
      myProp: 'this is the default',
      myTask() {
        propValue = this.myProp
      },
    })

    log('Starting test build')
    await invoke(tasks, 'myTask', { myProp: 'this is overridden' })
    expect(propValue).to.equal('this is overridden')
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

    log('Starting test build')
    await invoke(tasks2, 'myTask2')
    expect(calls).to.eql([
      'original myTask1', // invoked by overridden task 2
      'overridden myTask2', // calling other build's task 1
    ])
  })

  it('should fail with an invalid task name', async () => {
    const tasks = build({ myTask: () => void 0 })

    log('Starting test build')
    await expect(invoke(tasks, 'wrongTask'))
        .to.be.rejectedWith(BuildFailure, '')
  })

  it('should fail when a task fails', async () => {
    const tasks = build({ myTask: () => Promise.reject(new Error('Foo!')) })

    log('Starting test build')
    await expect(invoke(tasks, 'myTask'))
        .to.be.rejectedWith(BuildFailure, '')
  })

  it('should fail with an invalid build', async () => {
    log('Starting test build')
    await expect(invoke({}, 'wrongTask'))
        .to.be.rejectedWith(BuildFailure, /^$/)
  })

  it('should get the current task context', () => {
    const context1 = currentContext()
    const context2 = requireContext()
    expect(context1).to.equal(context2)
    expect(runningTasks()).to.include(context2.taskName)
  })
})
