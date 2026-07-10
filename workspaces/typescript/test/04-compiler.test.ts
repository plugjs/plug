import { find, mkdtemp, rmrf } from '@plugjs/plug'

import { TscCompiler, tsc } from '../src/tsccompiler'

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

  it('should build a full project', async () => {
    // Copy our builder test files to a temp directory
    const sources = await find('**/*', { directory: `${testDir}/compiler` }).copy(tempDir)

    // Check our source files
    expect([ ...sources ]).toMatchContents([
      'src/foobar.ts',
      'tsconfig.json',
      'tsconfig.options.json',
    ])

    // Build our project and check the resulting (written) files
    const result = await find('tsconfig.json', { directory: tempDir }).plug(new TscCompiler())
    expect([ ...result ]).toMatchContents([
      'dist/foobar.d.ts',
      'dist/foobar.js',
      'dist/foobar.js.map',
    ])

    // Check the full tree *after* building   our target files
    const targets = await find('**/*', { directory: tempDir })
    expect([ ...targets ]).toMatchContents([ ...sources, ...result ])
  })

  it('should build a full project using "tsc"', async () => {
    // Copy our builder test files to a temp directory
    const sources = await find('**/*', { directory: `${testDir}/compiler` }).copy(tempDir)

    // Check our source files
    expect([ ...sources ]).toMatchContents([
      'src/foobar.ts',
      'tsconfig.json',
      'tsconfig.options.json',
    ])

    // Build our project and check the resulting (written) files
    const result = await tsc({ directory: tempDir })

    expect([ ...result ]).toMatchContents([
      'dist/foobar.d.ts',
      'dist/foobar.js',
      'dist/foobar.js.map',
    ])

    // Check the full tree *after* building   our target files
    const targets = await find('**/*', { directory: tempDir })
    expect([ ...targets ]).toMatchContents([ ...sources, ...result ])
  })
})
