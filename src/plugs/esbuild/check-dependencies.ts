import type { Message, OnStartResult, Plugin } from 'esbuild'
import { currentRun } from '../../async'
import { $p } from '../../log'
import { AbsolutePath } from '../../paths'
import { readFile } from '../../utils/asyncfs'
import { ParseOptions, parseOptions } from '../../utils/options'

export interface CheckDependenciesOptions {
  allowDev?: boolean | 'warn' | 'error',
  allowPeer?: boolean | 'warn' | 'error',
  allowOptional?: boolean | 'warn' | 'error',
  allowUnused?: boolean | 'warn' | 'error',
}

export function checkDependencies(): Plugin
export function checkDependencies(packageJson: string): Plugin
export function checkDependencies(options: CheckDependenciesOptions): Plugin
export function checkDependencies(packageJson: string, options: CheckDependenciesOptions): Plugin

export function checkDependencies(...args: ParseOptions<CheckDependenciesOptions>): Plugin {
  const { params, options } = parseOptions(args, {
    allowDev: false,
    allowPeer: true,
    allowOptional: true,
    allowUnused: false,
  })

  const allowDev = convertOption(options.allowDev)
  const allowPeer = convertOption(options.allowPeer)
  const allowOptional = convertOption(options.allowOptional)
  const allowUnused = convertOption(options.allowUnused)

  const dependencies: string[] = []
  const devDependencies: string[] = []
  const peerDependencies: string[] = []
  const optionalDependencies: string[] = []
  const used = new Set<string>()

  return {
    name: 'check-dependencies',
    setup(build): void {
      let packageJson: AbsolutePath

      build.onStart(async (): Promise<OnStartResult | void> => {
        const run = currentRun()
        if (! run) return { errors: [ { text: 'Unable to find current Run' } ] }

        const resolved = run.resolve(params[0] || '@package.json')
        packageJson = resolved

        try {
          const data = await readFile(resolved, 'utf-8')
          const json = JSON.parse(data)
          dependencies.push(...dependencyKeys(json.dependencies))
          devDependencies.push(...dependencyKeys(json.devDependencies))
          peerDependencies.push(...dependencyKeys(json.peerDependencies))
          optionalDependencies.push(...dependencyKeys(json.optionalDependencies))
        } catch (error) {
          return { errors: [ { text: `Unable to parse ${$p(resolved)}` } ] }
        }
      })

      /* Intercept resolution */
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.importer.match(/\/node_modules\//)) return // only our sources
        if (args.path.startsWith('node:')) return // node imports
        if (args.path.startsWith('.')) return // local imports

        // Normal dependencies get the green light immediately
        if (dependencies.includes(args.path)) {
          used.add(args.path)
          return
        }

        // In order, here, we first check "optional" and "peers" (which should)
        // also have a corresponding entry in "dev" for things to work, then
        // "dev" is definitely checked last
        const [ result, label ] =
          optionalDependencies.includes(args.path) ? [ allowOptional, 'an optional' ] as const :
          peerDependencies.includes(args.path) ? [ allowPeer, 'a peer' ] as const :
          devDependencies.includes(args.path) ? [ allowDev, 'a dev' ] as const :
          [ 'error', undefined ] as const

        // If we're told to ignore, then... IGNORE!
        if (result === 'ignore') return

        // Prep the message
        const text = label ?
            `Dependency "${args.path}" is ${label} dependency` :
            `Dependency "${args.path}" not specified in "package.json"`

        // Return the proper error or warning
        return result === 'warn' ?
            { warnings: [ { text } ] } :
            { errors: [ { text } ] }
      })

      /* Check for unused */
      build.onEnd((result) => {
        if (allowUnused === 'ignore') return

        // Figure out every unused dependency
        const unused = new Set(dependencies)
        used.forEach((dep) => unused.delete(dep))

        // Convert the dependency name into a "message"
        const messages = [ ...unused ]
            .map((dep) => `Unused dependency "${dep}"`)
            .map((text): Message => ({
              id: '',
              pluginName: 'check-dependencies',
              location: {
                file: packageJson,
                namespace: 'file',
                line: 0,
                column: 0,
                length: 0,
                lineText: '',
                suggestion: '',
              },
              text,
              notes: [],
              detail: undefined,
            }))

        // Inject our messages either as warnings or errors
        if (allowUnused === 'warn') {
          result.warnings.push(...messages)
        } else {
          result.errors.push(...messages)
        }
      })
    },
  }
}

function convertOption(option?: boolean | 'warn' | 'error'): 'ignore' | 'warn' | 'error' {
  if (option === 'warn') return 'warn'
  if (option === 'error') return 'error'
  if (option) return 'ignore'
  return 'error'
}


function dependencyKeys(dependencies: any): string[] {
  if (! dependencies) return []
  if (typeof dependencies !== 'object') return []
  return Object.keys(dependencies).filter((key) => typeof key === 'string')
}
