import { BuildFailure, find, mkdtemp, resolve, rmrf } from '@plugjs/plug'
import ts from 'typescript'

import { Tsc } from '../src/typescript'

import type { AbsolutePath } from '@plugjs/plug'

describe('TypeScript Compiler', () => {
  let dir: AbsolutePath

  beforeEach(async () => {
    dir = await mkdtemp()
  })

  afterEach(async () => {
    await rmrf(dir)
  })

  /* ======================================================================== */

  it('should bundle a source file into an output file', async () => {
    const file = resolve(dir, 'output.js')

    const result = await find('**/*.ts', { directory: '@/data' })
        .plug(new Tsc('@/tsconfig-empty.json', {
          module: ts.ModuleKind.AMD,
          outDir: dir,
          outFile: file,
          noEmit: false,
          declaration: true,
        }))

    const files = [ ...await find('**', { directory: dir }) ]
    expect(files)
        .toHaveLength(2)
        .toInclude([
          'output.d.ts',
          'output.js',
        ])

    expect([ ...result ])
        .toHaveLength(2)
        .toInclude(files)
  })

  it('should compile some basic sources', async () => {
    const result = await find('**/*.ts', { directory: '@/data' })
        .plug(new Tsc({
          outDir: dir,
          noEmit: false,
          declaration: true,
        }))

    const files = [ ...await find('**', { directory: dir }) ]
    expect(files)
        .toHaveLength(4)
        .toInclude([
          'empty.d.ts',
          'empty.js',
          'simple.d.ts',
          'simple.js',
        ])
    expect([ ...result ])
        .toHaveLength(4)
        .toInclude(files)
  })

  it('should compile some files with a specific root directory', async () => {
    const result = await find('**/*.ts', { directory: '@/data' })
        .plug(new Tsc({
          outDir: dir,
          noEmit: false,
          declaration: true,
          rootDir: '@',
        }))

    const files = [ ...await find('**', { directory: dir }) ]
    expect(files)
        .toHaveLength(4)
        .toInclude([
          'data/empty.d.ts',
          'data/empty.js',
          'data/simple.d.ts',
          'data/simple.js',
        ])
    expect([ ...result ])
        .toHaveLength(4)
        .toInclude(files)
  })

  it('should compile some files with multiple root directories', async () => {
    const promise = find('**/*.ts', { directory: '@/rootdirs' })
        .plug(new Tsc())
    await expect(promise).toBeRejectedWithError(BuildFailure)

    const result = await find('**/*.ts', { directory: '@/rootdirs' })
        .plug(new Tsc({
          outDir: dir,
          noEmit: false,
          declaration: false,
          rootDirs: [ '@/rootdirs/a', '@/rootdirs/b' ],
        }))

    const files = [ ...await find('**', { directory: dir }) ]
    expect(files)
        .toHaveLength(2)
        .toInclude([
          'a/one.js',
          'b/two.js',
        ])
    expect([ ...result ])
        .toHaveLength(2)
        .toInclude(files)
  })

  it('should compile some files with base url', async () => {
    const promise = find('**/*.ts', { directory: '@/baseurl' })
        .plug(new Tsc())
    await expect(promise).toBeRejectedWithError(BuildFailure)

    const result = await find('**/*.ts', { directory: '@/baseurl' })
        .plug(new Tsc({
          outDir: dir,
          noEmit: false,
          declaration: false,
          rootDir: '@/baseurl',
          baseUrl: '@/baseurl/a',
        }))

    const files = [ ...await find('**', { directory: dir }) ]
    expect(files)
        .toHaveLength(2)
        .toInclude([
          'a/one.js',
          'b/two.js',
        ])
    expect([ ...result ])
        .toHaveLength(2)
        .toInclude(files)
  })
})
