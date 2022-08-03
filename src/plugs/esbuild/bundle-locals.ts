import type { Plugin } from 'esbuild'

import { $und, log } from '../../log'

/**
 * A simple ESBuild plugin bundling _only_ local files, and marking anything
 * imported from `node_modules` as _external_.
 */
export const bundleLocals: Plugin = {
  name: 'bundle-locals',

  setup(build): void {
    if (! build.initialOptions.bundle) {
      log.warn(`ESBuild ${$und('bundle-locals')} plugin disabled when not bundling`)
      return
    }

    /* Intercept resolution */
    build.onResolve({ filter: /.*/ }, (args) => {
      /* Ignore the entry points (when the file is not being imported) */
      if (! args.importer) return null

      /* Anything not starting with "."? external node module */
      return args.path.startsWith('.') ? null : { external: true }
    })
  },
}
