import { find, mkdtemp, rmrf } from '@plugjs/plug'

import { TscBuild } from '../src/tscbuild'

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
    const sources = await find('**/*', { directory: `${testDir}/builder` }).copy(tempDir)

    // Check our source files
    expect([ ...sources ]).toMatchContents([
      'a/a.ts',
      'b/b.ts',
      'tsconfig.a.json',
      'tsconfig.b.json',
      'tsconfig.json',
      'tsconfig.options.json',
    ])

    // Build our project and check the resulting (written) files
    const result = await find('tsconfig.json', { directory: tempDir }).plug(new TscBuild())
    expect([ ...result ]).toMatchContents([
      'dist/a.d.ts',
      'dist/a.js',
      'dist/a.js.map',
      'dist/b.d.ts',
      'dist/b.js',
      'dist/b.js.map',
      'tmp/tsconfig.a.tsbuildinfo',
      'tmp/tsconfig.b.tsbuildinfo',
    ])

    // Check the full tree *after* building   our target files
    const targets = await find('**/*', { directory: tempDir })
    expect([ ...targets ]).toMatchContents([ ...sources, ...result ])
  })
})
