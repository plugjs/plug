import { parallel, read, task } from './bootstrap/src'

export const compile = task('Compile source code', () =>
  read('src/**/*.ts', 'test/**/*.ts', 'test/.setup.ts', { ignore: 'test/support' })
      .compile('tsconfig.json')
      // .mocha('test/**/*.test.ts')
      .write('build', { sourceMaps: 'external' }))

export const instrument = task('Instrument source code', () =>
  read('src/**/*.ts', 'test/**/*.ts', 'test/.setup.ts', { ignore: 'test/support' })
      .compile('tsconfig.json')
      .instrument('**/*.ts')
      .mocha('test/**/*.test.ts')
      .istanbul())
// .write('instrumented', { sourceMaps: 'external' })

export default parallel('Run Everything', compile, instrument)
