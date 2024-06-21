import { fork } from 'node:child_process'
import { Console } from 'node:console'
import { Writable } from 'node:stream'

import { assert, BuildFailure } from './asserts'
import { runAsync } from './async'
import { Files } from './files'
import { $gry, $p, $red, logOptions, NOTICE, WARN } from './logging'
import { emit, emitForked } from './logging/emit'
import { requireFilename, resolveFile } from './paths'
import { Context, install } from './pipe'

import type { ForkedLogMessage } from './logging/emit'
import type { AbsolutePath } from './paths'
import type { Plug, PlugName, PlugResult } from './pipe'

/**
 * Options accepted by {@link ForkingPlug}'s instrumenting how the process
 * will be spawned (environment variables to be passed to the child process).
 */
export interface ForkOptions {
  /** The directory where coverage data will be saved */
  coverageDir?: string,
  /** Force the specified module type when dynamically transpiling TypeScript */
  forceModule?: 'commonjs' | 'module'
}

/** Fork data, from parent to child process */
export interface ForkData {
  /** Script name for the Plug to execute */
  scriptFile: AbsolutePath,
  /** Export name in the script for the Plug to execute */
  exportName: string,
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
  logIndent: number,
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

export abstract class ForkingPlug implements Plug<PlugResult> {
  constructor(
      private readonly _scriptFile: AbsolutePath,
      private readonly _arguments: any[],
      private readonly _exportName: string,
  ) {}

  pipe(files: Files, context: Context): Promise<PlugResult> {
    const request: ForkData = {
      scriptFile: this._scriptFile,
      exportName: this._exportName,
      constructorArgs: this._arguments,
      taskName: context.taskName,
      buildFile: context.buildFile,
      filesDir: files.directory,
      filesList: [ ...files.absolutePaths() ],
      logIndent: context.log.indent,
    }

    /* Get _this_ filename to spawn */
    const script = requireFilename(__fileurl)
    context.log.debug('About to fork plug from', $p(this._scriptFile))

    /* Environment variables */
    const env = { ...process.env, ...logOptions.forkEnv(context.taskName) }

    /* Check our args (reversed) to see if the last specifies `coverageDir` */
    for (let i = this._arguments.length - 1; i >= 0; i --) {
      if (this._arguments[i] == null) continue // null or undefined... optionals
      if (typeof this._arguments[i] === 'object') {
        if (typeof this._arguments[i].coverageDir === 'string') {
          const dir = env.NODE_V8_COVERAGE = context.resolve(this._arguments[i].coverageDir)
          context.log.debug('Forked process will produce coverage in', $p(dir))
        }
        if (typeof this._arguments[i].forceModule === 'string') {
          const force = env.__TS_LOADER_FORCE_TYPE = this._arguments[i].forceModule
          context.log.debug('Forked process will force module type as', $p(force))
        }
      }
    }

    /* Run our script in a _separate_ process */
    const child = fork(script, {
      stdio: [ 'ignore', 'inherit', 'inherit', 'ipc' ],
      serialization: 'advanced',
      env,
    })

    /* Do some logging... */
    context.log.info('Running', $p(script), $gry(`(pid=${child.pid})`))

    /* Return a promise from the child process events */
    let done = false // this will be fixed up in "finally" below
    return new Promise<PlugResult>((resolve, reject) => {
      let response: ForkResult | undefined = undefined

      child.on('error', (error) => {
        context.log.error('Forked plug process error', error)
        return done || reject(BuildFailure.fail())
      })

      child.on('message', (message: ForkResult | ForkedLogMessage) => {
        if ('logLevel' in message) {
          const { logLevel, taskName, lines } = message
          lines.forEach((line) => {
            // this is _a hack_, as we want to reuse the indent and prefix of
            // the current log, but the task name from the forked plug!!!
            (context.log as any)._emit(logLevel, [ line ], taskName)
          })
        } else {
          context.log.debug('Message from forked plug process with PID', child.pid, message)
          response = message
        }
      })

      child.on('exit', (code, signal) => {
        if (signal) {
          context.log.error(`Forked plug process exited with signal ${signal}`, $gry(`(pid=${child.pid})`))
          return done || reject(BuildFailure.fail())
        } else if (code !== 0) {
          context.log.error(`Forked plug process exited with code ${code}`, $gry(`(pid=${child.pid})`))
          return done || reject(BuildFailure.fail())
        } else if (! response) {
          context.log.error('Forked plug process exited with no result', $gry(`(pid=${child.pid})`))
          return done || reject(BuildFailure.fail())
        } else if (response.failed) {
          // definitely logged on the child side
          return done || reject(BuildFailure.fail())
        }

        /* We definitely have a successful result! */
        return done || resolve(response.filesDir && response.filesList ?
            Files.builder(response.filesDir).add(...response.filesList).build() :
            undefined)
      })

      /* After the handlers have been setup, send the message */
      try {
        /* Ignore the return value from `child.send(...)` here. The docs allow
         * it to return `false` _when the backlog of unsent messages exceeds a
         * threshold that makes it unwise to send more_. Bascially, on large
         * file lists, this returns `false`... The only thing we can do is to
         * handle any callback error, and hope for the best!
         */
        child.send(request, (error) => {
          if (error) {
            context.log.error('Error sending message to forked plug process (callback failure)', error)
            reject(BuildFailure.fail())
          }
        })
      } catch (error) {
        context.log.error('Error sending message to forked plug process (exception caught)', error)
        reject(BuildFailure.fail())
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
  /* Save the original console, we'll replace it on "message" */
  const originalConsole = globalThis.console

  /* Unhandled exceptions and graceful termination */
  process.on('uncaughtException', (error, origin) => {
    originalConsole.error(
        $red('\n= UNCAUGHT EXCEPTION ========================================='),
        `\nError (${origin}):`, error,
        `\nNode.js ${process.version} (pid=${process.pid})\n`)
    process.nextTick(() => process.exit(3))
  })

  /* If we haven't processed our message in 5 seconds, fail _badly_ */
  const timeout = setTimeout(() => {
    originalConsole.error('Fork not initialized in 5 seconds')
    process.exit(2)
  }, 5000).unref()

  /* Await our message to initialize and run the plug */
  process.on('message', (message: ForkData) => {
    clearTimeout(timeout)

    const {
      scriptFile,
      exportName,
      constructorArgs,
      taskName,
      buildFile,
      filesDir,
      filesList,
      logIndent,
    } = message

    /* Before anything else, capture logs! */
    emit.emitter = emitForked // replace the log emitter...

    /* Create a couple of writers for our fake "stdout" and "stderr" */
    const stdout = new class extends Writable {
      _write(chunk: any, _: BufferEncoding, callback: (error?: Error | null) => void): void {
        emit.emitter({ level: NOTICE, taskName }, [ chunk.toString() ])
        callback()
      }
    }

    const stderr = new class extends Writable {
      _write(chunk: any, _: BufferEncoding, callback: (error?: Error | null) => void): void {
        emit.emitter({ level: WARN, taskName }, [ chunk.toString() ])
        callback()
      }
    }

    /* Replace the console with our own sending messages as logs */
    globalThis.console = new Console(stdout, stderr)

    /* First of all, our plug context */
    const context = new Context(buildFile, taskName)
    context.log.indent = logIndent
    context.log.debug('Message from parent process for PID', process.pid, message)

    /* Contextualize this run, and go! */
    process.exitCode = 0
    const result = runAsync(context, async () => {
      /* Check that we have a proper script file name */
      assert(resolveFile(scriptFile), `Script file ${$p(scriptFile)} not found`)
      const script = await import(scriptFile)

      /* Figure out the constructor, in the "default" chain */
      let Ctor
      if (exportName === 'default') {
        Ctor = script
        while (Ctor && (typeof Ctor !== 'function')) Ctor = Ctor.default
        assert(typeof Ctor === 'function', `Script ${$p(scriptFile)} does not export a default constructor`)
      } else {
        Ctor = script[exportName]
        if ((! Ctor) && (script.default)) Ctor = script.default[exportName]
        assert(typeof Ctor === 'function', `Script ${$p(scriptFile)} does not export "${exportName}"`)
      }

      /* Create the Plug instance and our Files instance */
      const plug = new Ctor(...constructorArgs) as Plug<PlugResult>
      const files = Files.builder(filesDir).add(...filesList).build()

      /* Run and return the result */
      return plug.pipe(files, context)
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
      context.log.error(error)
      return new Promise<void>((resolve, reject) => {
        process.send!({ failed: true }, (err: Error) => err ? reject(err) : resolve())
      })
    })

    /* The promise generated by `process.send()` simply triggers process exit */
    promise.then(() => {
      context.log.debug('Forked plug with pid', process.pid, 'exiting')
    }, (error) => {
      originalConsole.error('\n\nError sending message back to parent process', error)
      process.exitCode = 1
    }).finally(() => {
      process.disconnect()
      process.exit(process.exitCode)
    })
  })
}

/**
 * Install a _forking_ {@link Plug} in the {@link Pipe}, in other words
 * execute the plug in a separate process.
 *
 * As a contract, if the _last non-null_ parameter of the constructor is an
 * object and contains the key `coverageDir`, the process will be forked with
 * the approptiately resolved `NODE_V8_COVERAGE` environment variable.
 *
 * Also, forking plugs require some special attention:
 *
 * * plug functions are not supported, only classes implementing the
 *   {@link Plug} interface can be used with this.
 *
 * * the class itself _MUST_ be exported as the _default_ export for the
 *   `scriptFile` specified below. This is to simplify interoperability between
 *   CommonJS and ESM modules as we use dynamic `import(...)` statements.
 */
export function installForking<Name extends PlugName>(
    plugName: Name,
    scriptFile: AbsolutePath,
    exportName: string = 'default',
): void {
  /** Extend out our ForkingPlug below */
  const ctor = class extends ForkingPlug {
    constructor(...args: any[]) {
      super(scriptFile, args, exportName)
    }
  }

  /** Install the plug in  */
  install(plugName, ctor as any)
}
