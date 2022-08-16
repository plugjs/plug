import { Plugin } from 'esbuild'

/**
 * A simple ESBuild plugin bundling _only_ local files, and marking anything
 * imported from `node_modules` as _external_.
 */
export function bundleLocals(): Plugin {
  let disabled = false

  return {
    name: 'bundle-locals',

    setup(build): void {
      build.onStart(() => {
        if (build.initialOptions.bundle) return

        disabled = true
        return { warnings: [ { text: 'Plugin disabled when not bundling' } ] }
      })

      /* Intercept resolution */
      build.onResolve({ filter: /.*/ }, (args) => {
        if (disabled) return

        /* Ignore the entry points (when the file is not being imported) */
        if (! args.importer) return null

        /* Anything not starting with "."? external node module */
        return args.path.startsWith('.') ? null : { external: true }
      })
    },
  }
}
