import { $p, build, find, fixExtensions, log, merge, resolve } from './workspaces/plug/src/index'

import type { ESBuildOptions, Files } from './workspaces/plug/src/index'

// console.log('PLUG IS', plug)

const workspaces = [
  'workspaces/cov8',
  'workspaces/eslint',
  'workspaces/jasmine',
  'workspaces/plug',
  'workspaces/typescript',
] as const

/** Shared ESBuild options */
const esbuildOptions: ESBuildOptions = {
  platform: 'node',
  target: 'node18',
  sourcemap: 'linked',
  sourcesContent: false,
  plugins: [ fixExtensions() ],
}

export default build({
  /** Transpile to CJS */
  async transpile_cjs(): Promise<Files> {
    return merge(workspaces.map((workspace) => {
      log.notice(`Transpiling sources to CJS from ${$p(resolve(workspace))}`)
      return find('**/*.([cm])?ts', { directory: `${workspace}/src` })
          .esbuild({
            ...esbuildOptions,
            format: 'cjs',
            outdir: `${workspace}/dist`,
            outExtension: { '.js': '.cjs' },
          })
    }))
  },

  /** Transpile to ESM */
  async transpile_esm(): Promise<Files> {
    return merge(workspaces.map((workspace) => {
      log.notice(`Transpiling sources to ESM from ${$p(resolve(workspace))}`)
      return find('**/*.([cm])?ts', { directory: `${workspace}/src` })
          .esbuild({
            ...esbuildOptions,
            format: 'esm',
            outdir: `${workspace}/dist`,
            outExtension: { '.js': '.mjs' },
          })
    }))
  },

  /** Generate all .d.ts files */
  async transpile_dts(): Promise<Files> {
    const tsc = await import('./workspaces/typescript/src/typescript.js')

    return merge(workspaces.map((workspace) => {
      log.notice(`Transpiling Typescript types from ${$p(resolve(workspace))}`)
      return find('**/*.([cm])?ts', { directory: `${workspace}/src` })
          .plug(new tsc.default.Tsc(`${workspace}/tsconfig-base.json`, {
            noEmit: false,
            declaration: true,
            emitDeclarationOnly: true,
            outDir: `${workspace}/dist`,
          }))
    }))
  },

  async default(): Promise<void> {
    await this.transpile_cjs()
    await this.transpile_esm()
    await this.transpile_dts()
  },
})
