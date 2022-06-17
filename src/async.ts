import { AsyncLocalStorage } from 'node:async_hooks'
import type { Build, TaskDescriptor } from './build'
import type { Run } from './run'

export interface AsyncContext {
  run: Run,
  build: Build<any>,
  task: TaskDescriptor,
}

export function currentRun(): Run | undefined {
  return storage.getStore()?.run
}

export function currentBuild<D>(): Build<D> | undefined {
  return storage.getStore()?.build
}

export function currentTask(): TaskDescriptor | undefined {
  return storage.getStore()?.task
}

export function runningTasks(): TaskDescriptor[] {
  return [ ...tasks ]
}

export function runAsync<T>(context: AsyncContext, callback: () => Promise<T>): Promise<T> {
  return storage.run(context, () => {
    try {
      tasks.push(context.task)
      return callback()
    } finally {
      const index = tasks.lastIndexOf(context.task)
      if (index >= 0) tasks.splice(index, 1)
    }
  })
}

const storage = new AsyncLocalStorage<AsyncContext>()
const tasks = new Array<TaskDescriptor>()
