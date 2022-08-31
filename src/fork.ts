import { fork } from 'node:child_process'
import { assert, failure } from './assert.js'
import { runAsync } from './async.js'
import { Files } from './files.js'
import { $gry, $p, LogOptions, logOptions } from './log.js'
import { AbsolutePath, requireFilename, resolveFile } from './paths.js'
import { RunImpl } from './run.js'
import { Plug, Result, RunContext } from './types.js'

/** Fork data, from parent to child process */
export interface ForkData {
  /** Script name for the Plug to execute */
  scriptFile: AbsolutePath,
  /** Plug constructor arguments */
  constructorArgs: any[],
  /** Task name (for logs) */
  taskName: string,
  /** Build file name */
  buildFile: AbsolutePath,
  /** Files directory */
  filesDir: AbsolutePath,
  /** All files to pipe */
  filesList: AbsolutePath[],
  /** Options for our logger in the child process */
  logOpts: Partial<LogOptions>,
}

/** Fork result, from child to parent process */
export interface ForkResult {
  /** If this is `true` we _might_ have `filesDir` and `filesList` */
  failed: boolean,
  /** Files directory of the result */
  filesDir?: AbsolutePath | undefined,
  /** All files returned by the plug */
  filesList?: AbsolutePath[] | undefined,
}

/* ========================================================================== *
 * PARENT PROCESS SIDE OF THE FORKING PLUG IMPLEMENTATION                     *
 * ========================================================================== */

export abstract class ForkingPlug implements Plug<Result> {
  constructor(
      private readonly _scriptFile: AbsolutePath,
      private readonly _arguments: any[],
  ) {}

  pipe(files: Files, run: RunContext): Promise<Result> {
    const message: ForkData = {
      scriptFile: this._scriptFile,
      constructorArgs: this._arguments,
      taskName: run.taskName,
      buildFile: run.buildFile,
      filesDir: files.directory,
      filesList: [ ...files.absolutePaths() ],
      logOpts: logOptions.fork(run.taskName),
    }

    /* Get _this_ filename to spawn */
    const script = requireFilename(__fileurl)
    run.log.debug('About to fork plug from', $p(script))

    /* Environment variables */
    const env = { ...process.env }

    /* Check our args (reversed) to see if the last specifies `coverageDir` */
    for (let i = this._arguments.length - 1; i >= 0; i --) {
      if (this._arguments[i] == null) continue // null or undefined... optionals
      if (typeof this._arguments[i] === 'object') {
        if (typeof this._arguments[i].coverageDir === 'string') {
          const dir = env.NODE_V8_COVERAGE = run.resolve(this._arguments[i].coverageDir)
          run.log.debug('Forked process will produce coverage in', $p(dir))
        }
      }
    }

    /* Run our script in a _separate_ process */
    const child = fork(script, {
      stdio: [ 'ignore', 'inherit', 'inherit', 'ipc' ],
      env,
    })

    run.log.info('Running', $p(script), $gry(`(pid=${child.pid})`))

    /* Return a promise from the child process events */
    let done = false // this will be fixed up in "finally" below
    return new Promise<Result>((resolve, reject) => {
      let result: ForkResult | undefined = undefined

      child.on('error', (error) => {
        run.log.error('Child process error', error)
        return done || reject(failure())
      })

      child.on('message', (message: ForkResult) => {
        run.log.debug('Message from child process', message)
        result = message
      })

      child.on('exit', (code, signal) => {
        if (signal) {
          run.log.error(`Child process exited with signal ${signal}`, $gry(`(pid=${child.pid})`))
          return done || reject(failure())
        } else if (code !== 0) {
          run.log.error(`Child process exited with code ${code}`, $gry(`(pid=${child.pid})`))
          return done || reject(failure())
        } else if (! result) {
          run.log.error('Child process exited with no result', $gry(`(pid=${child.pid})`))
          return done || reject(failure())
        } else if (result.failed) {
          // definitely logged on the child side
          return done || reject(failure())
        }

        /* We definitely have a successful result! */
        return done || resolve(message.filesDir && message.filesList ?
            Files.builder(message.filesDir).add(...message.filesList).build() :
            undefined)
      })

      /* After the handlers have been setup, send the message */
      try {
        const result = child.send(message, (error) => {
          if (error) {
            run.log.error('Error sending message to child process (callback failure)', error)
            reject(failure())
          }
        })
        if (! result) {
          run.log.error('Error sending message to child process (send returned false)')
          reject(failure())
        }
      } catch (error) {
        run.log.error('Error sending message to child process (exception caught)', error)
        reject(failure())
      }
    }).finally(() => done = true)
  }
}


/* ========================================================================== *
 * CHILD PROCESS SIDE OF THE FORKING PLUG IMPLEMENTATION                      *
 * ========================================================================== */

/*
 * If we were started as ourselves (fork.js) and we have an IPC channel to the
 * parent process, we can safely assume we need to run our plug... So we wait
 * for the message and respond once the plug returns _something_!
 */
if ((process.argv[1] === requireFilename(__fileurl)) && (process.send)) {
  /* If we haven't processed our message in 5 seconds, fail _badly_ */
  const timeout = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('Mocha not initialized in 5 seconds')
    process.exit(2)
  }, 5000)

  /* Await our message to initialize and run the plug */
  process.on('message', (message: ForkData) => {
    clearTimeout(timeout)

    const {
      scriptFile,
      constructorArgs,
      taskName,
      buildFile,
      filesDir,
      filesList,
      logOpts,
    } = message

    /* Restore logging options first */
    Object.assign(logOptions, logOpts)

    /* First of all, our Run */
    const run = new RunImpl(buildFile, taskName)
    run.log.debug('Message from parent process', message)

    /* Contextualize this run, and go! */
    const result = runAsync(run, taskName, async () => {
      /* Check that we have a proper script file name */
      assert(resolveFile(scriptFile), `Script file ${$p(scriptFile)} not found`)
      const script = await import(scriptFile)

      /* Figure out the constructor, in the "default" chain */
      let Ctor = script
      while (Ctor && (typeof Ctor !== 'function')) Ctor = Ctor.default

      /* Check that we have a proper constructor */
      assert(typeof Ctor === 'function',
          `Script ${$p(scriptFile)} does not export a default constructor`)

      /* Create the Plug instance and our Files instance */
      const plug = new Ctor(...constructorArgs) as Plug<Result>
      const files = Files.builder(filesDir).add(...filesList).build()

      /* Run and return the result */
      return plug.pipe(files, run)
    })

    /* The result promise generates a message back to the parent process */
    const promise = result.then((result) => {
      const message: ForkResult = result ?
        { failed: false, filesDir: result.directory, filesList: [ ...result.absolutePaths() ] } :
        { failed: false }
      return new Promise<void>((resolve, reject) => {
        process.send!(message, (err: Error) => err ? reject(err) : resolve())
      })
    }, (error) => {
      run.log.error(error)
      return new Promise<void>((resolve, reject) => {
        process.send!({ failed: true }, (err: Error) => err ? reject(err) : resolve())
      })
    })

    /* The promise generated by `process.send()` simply triggers process exit */
    promise.then(() => {
      run.log.debug('Forked plug exiting')
      process.exit(0)
    }, (error) => {
      run.log.error('Error sending message back to parent process', error)
      process.exit(1)
    })
  })
}
