import type { Files } from './files'
import type { AbsolutePath } from './paths'
import type { Plug, PlugConstructor } from './pipe'

import nodeAssert from 'node:assert'

import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads'
import { runAsync } from './async'
import { $p, buildFailed, logOptions, LogOptions } from './log'
import { initRun, Run } from './run'
import { extname } from 'node:path'

// import r from 'ts-node'

// r.register({})

/** Worker data, from main thread to worker thread */
interface WorkerData<T extends any[]> {
  /** Log options from main thread */
  logOptions: LogOptions,
  /** Task name (for logs) */
  taskName?: string | undefined,
  /** Build file name */
  buildFile: AbsolutePath
  /** Build directory */
  buildDir: AbsolutePath,
  /** Files directory */
  filesDir: AbsolutePath,
  /** All files to pipe */
  files: AbsolutePath[],
  /** Arguments to construct the plug */
  args: T,
}

/** Worker message, from worker thread back to main thread */
type WorkerMessage<T extends Files | undefined> = {
  failed: true,
  result?: undefined
} | {
  failed: false,
  result: T,
}

/**
 * Execute a plug in a {@link Worker} thread.
 *
 * We do some work here to make sure we have the correct types for the
 * constructor parameters, while maintaining a degree of separation in imports
 * (so that huge libs like `typescript` don't get imported all the time).
 *
 * In the _worker_ {@link Plug} we can write:
 *
 * ```
 * export type WorkerPlugType = typeof WorkerPlug
 *
 * class WorkerPlug implements Plug<...> {
 *  constructor(...) { ... }
 * }
 * ```
 *
 * Then in the _main_ thread we can simply import the type:
 *
 * ```
 * import type WorkerPlugType from '...'
 *
 * executeWorker<WorkerPlugType>(...)
 * ```
 *
 * And both constructor parameters and return type) should be handled correctly.
 */
export function executeWorker<
  T extends PlugConstructor,
  Args extends any[] = ConstructorParameters<T>,
  Result extends Files | undefined = Awaited<ReturnType<InstanceType<T>['pipe']>>>(
    /** The {@link AbsolutePath} of the {@link Worker}'s script. */
    script: AbsolutePath,
    /** The {@link Files} instance from {@link Plug.pipe}. */
    files: Files,
    /** The {@link Run} instance from {@link Plug.pipe}. */
    run: Run,
    /** Constructor arguments for the {@link Plug} */
    ...args: Args
): Promise<Result> {
  /* Create the data to be passed to the worker */
  const workerData: WorkerData<Args> = {
    taskName: run.taskName,
    buildFile: run.buildFile,
    buildDir: run.buildDir,
    filesDir: files.directory,
    files: [ ...files.absolutePaths() ],
    logOptions,
    args,
  }

  /*
   * If we are using "ts-node" (as in our _bootstrap_ process, when the script
   * to be executed has a ".ts" extension) we need to first require the
   * "ts-node/register/transpile-only" script to make sure that ".ts" files are
   * handled correctly. We use the "transpile-only" version for speed, in this
   * case, without checking types in our sources...
   */
  const worker =
    extname(script) !== '.ts' ?
      new Worker(script, { workerData }) :
      new Worker(` throw new Error('byebye');
        require('ts-node/register/transpile-only');
        const { parentPort } = require('node:worker_threads');
        const script = ${JSON.stringify(script)};
        try {
          require(script);
        } catch (error) {
          console.log('\\n\\n[ts-node] Error running script:', script);
          console.log('\\n\\n', error, '\\n\\n');
          process.nextTick(() => parentPort.postMessage({ failed: true }));
        }`,
      { eval: true, workerData })

  /* Return the promise that will actually wait for the worker */
  return new Promise<Result>((resolve, reject) => {
    let completed = false // keep state to avoid double logging
    let failed = true // fail by default
    let result: Result

    /* Worker message error */
    worker.on('messageerror', (error) => {
      if (completed) return
      run.log.error('Message error in worker', $p(script), error)
      reject(buildFailed)
      completed = true
    })

    /* Worker error */
    worker.on('error', (error) => {
      if (completed) return
      run.log.error('Error in worker', $p(script), error)
      reject(buildFailed)
      completed = true
    })

    /* Worker result, simply copy locally and wait for exit */
    worker.on('message', (message: WorkerMessage<Result>) => {
      failed = !! message.failed
      result = message.result!
    })

    /* On exit let's see what happend */
    worker.on('exit', (code) => {
      if (completed) return

      // This should be caught by "on('error')" but anyway...
      if (code != 0) {
        run.log.error('Worker', $p(script), 'terminated with code', code)
        reject(buildFailed)
        completed = true
      }

      // Reject, resolve, and mark as completed
      if (failed) reject(buildFailed)
      else resolve(result!)
      completed = true
    })
  })
}

/**
 * Main entry point for a {@link Plug} running in a {@link Worker} thread.
 *
 * We can simply write a worker script as follows:
 *
 * ```
 * class WorkerPlug implements Plug<...> {
 *  constructor(...) { ... }
 * }
 *
 * workerMain(WorkerPlug)
 * ```
 *
 * And then {@link executePlug} will take care of creating and running the
 * {@link Plug} as if it were in the _main_ thread.
 */
export function workerMain<
  T extends PlugConstructor,
  P extends Plug<Files | undefined> = InstanceType<T>,
  Args extends any[] = ConstructorParameters<T>,
  Result extends Files | undefined = Awaited<ReturnType<P['pipe']>>>(
    plug: T,
): void {
  // Here `workerData` _might_ be null, so before failing miserably...
  const data = workerData as WorkerData<Args> || {}

  // Basic assertion for worker, we are not in the main thread
  nodeAssert(!isMainThread, 'This can only run in a worker')

  // Recreate our logger in the worker (padding, colors, ...)
  Object.assign(logOptions, data.logOptions)

  // Spread out our arguments
  const { taskName, buildFile, buildDir, filesDir, files, args } = data

  // Post our message back to the main thread
  function postMessage(message: WorkerMessage<Result>): void {
    nodeAssert(parentPort, 'No parent port associated with worker')
    parentPort.postMessage(message)
  }

  // Initialize a fake `Run` with no tasks, but with a task name for logs
  const run = initRun({ buildDir, buildFile, tasks: {} }, taskName)

  // Run the Plug asynchronously in our context, so that `log`, `find`, ...
  // and all calls depending on our asynchronous `Run` work correctly
  runAsync(run, taskName || '', async () => {
    // eslint-disable-next-line new-cap
    const p = new plug(...args)
    const f = run.files(filesDir).add(...files).build()
    const result = await p.pipe(f, run) as Result
    postMessage({ result, failed: false })
  }).catch((error) => {
    run.log.error(error)
    postMessage({ failed: true })
  })
}
