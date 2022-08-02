import { build, log, find, parallel } from './src/index'

const booststrap = build({
  async compile_sources() {
    return find('**/*.ts', { directory: 'src' })
        .esbuild({ outdir: 'build/src' })
  },
  async compile_tests() {
    return find('**/*.ts', { directory: 'test' })
        .esbuild({ outdir: 'build/test' })
  },
  async compile_types() {
    return find('**/*.ts', { directory: 'src' })
        .debug()
        .tsc('tsconfig.json', {
          noEmit: false,
          declaration: true,
          emitDeclarationOnly: true,
          outDir: './build/types',
        })
        .debug()
  },
  async default() {
    await parallel(
        this.compile_sources(),
        this.compile_tests(),
        this.compile_types(),
    )
  },
})

booststrap.default()
    .then((result) => log.info('All done!', result))
    .catch((error) => log.error('Build error', error))
