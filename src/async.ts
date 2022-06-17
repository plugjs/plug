import { AsyncLocalStorage } from 'node:async_hooks'
import type { Task } from './build'
import type { Run } from './run'

export interface AsyncContext {
  run: Run,
  task: Task,
}

export function currentRun(): Run | undefined {
  return storage.getStore()?.run
}

export function currentTask(): Task | undefined {
  return storage.getStore()?.task
}

export function runningTasks(): Task[] {
  return [ ...tasks ]
}

export function runAsync<T>(context: AsyncContext, callback: () => Promise<T>): Promise<T> {
  return storage.run(context, () => {
    tasks.push(context.task)
    return callback().finally(() => {
      const index = tasks.lastIndexOf(context.task)
      if (index >= 0) tasks.splice(index, 1)
    })
  })
}

const storage = new AsyncLocalStorage<AsyncContext>()
const tasks = new Array<Task>()
