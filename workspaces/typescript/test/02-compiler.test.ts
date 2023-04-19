import { BuildFailure, find, mkdtemp, resolve, rmrf } from '@plugjs/plug'
import ts from 'typescript'

import { Tsc } from '../src/typescript'

import type { AbsolutePath } from '@plugjs/plug'

describe('TypeScript Compiler', () => {
  const testDir = '@/workspaces/typescript/test'
  let tempDir: AbsolutePath

  beforeEach(async () => {
    tempDir = await mkdtemp()
  })

  afterEach(async () => {
    await rmrf(tempDir)
  })

  /* ======================================================================== */

  it('should bundle a source file into an output file', async () => {
    const file = resolve(tempDir, 'output.js')

    const result = await find('**/*.ts', { directory: `${testDir}/data` })
        .plug(new Tsc(`${testDir}/tsconfig-empty.json`, {
          module: ts.ModuleKind.AMD,
          outDir: tempDir,
          outFile: file,
          noEmit: false,
          declaration: true,
        }))

    const files = [ ...await find('**', { directory: tempDir }) ]
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
    const result = await find('**/*.ts', { directory: `${testDir}/data` })
        .plug(new Tsc({
          outDir: tempDir,
          noEmit: false,
          declaration: true,
        }))

    const files = [ ...await find('**', { directory: tempDir }) ]
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
    const result = await find('**/*.ts', { directory: `${testDir}/data` })
        .plug(new Tsc({
          outDir: tempDir,
          noEmit: false,
          declaration: true,
          rootDir: '@',
        }))

    const files = [ ...await find('**', { directory: tempDir }) ]
    expect(files)
        .toHaveLength(4)
        .toInclude([
          'workspaces/typescript/test/data/empty.d.ts',
          'workspaces/typescript/test/data/empty.js',
          'workspaces/typescript/test/data/simple.d.ts',
          'workspaces/typescript/test/data/simple.js',
        ])
    expect([ ...result ])
        .toHaveLength(4)
        .toInclude(files)
  })

  it('should compile some files with multiple root directories', async () => {
    const promise = find('**/*.ts', { directory: `${testDir}/rootdirs` })
        .plug(new Tsc())
    await expect(promise).toBeRejectedWithError(BuildFailure)

    const result = await find('**/*.ts', { directory: `${testDir}/rootdirs` })
        .plug(new Tsc({
          outDir: tempDir,
          noEmit: false,
          declaration: false,
          rootDirs: [ `${testDir}/rootdirs/a`, `${testDir}/rootdirs/b` ],
        }))

    const files = [ ...await find('**', { directory: tempDir }) ]
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
    const promise = find('**/*.ts', { directory: `${testDir}/baseurl` })
        .plug(new Tsc())
    await expect(promise).toBeRejectedWithError(BuildFailure)

    const result = await find('**/*.ts', { directory: `${testDir}/baseurl` })
        .plug(new Tsc({
          outDir: tempDir,
          noEmit: false,
          declaration: false,
          rootDir: `${testDir}/baseurl`,
          baseUrl: `${testDir}/baseurl/a`,
        }))

    const files = [ ...await find('**', { directory: tempDir }) ]
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
