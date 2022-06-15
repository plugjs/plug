import { AsyncLocalStorage } from 'node:async_hooks'
import type { Task } from './build'

export function currentTask(): Task | undefined {
  return asyncTasksStorage.getStore()
}

export const asyncTasksStorage = new AsyncLocalStorage<Task>()
