import { resolve } from '@plugjs/plug'
import ts from 'typescript'

import { getCompilerOptions } from '../src/options'

describe('TypeScript Compiler Options', () => {
  const testDir = '@/workspaces/typescript/test'
  const files = [ filenameFromUrl(__fileurl) ]

  it('should return the default options or fail', async () => {
    let { options, errors } = await getCompilerOptions(undefined, {}, files)
    expect(options).toEqual(ts.getDefaultCompilerOptions())
    expect(errors).toEqual([])


    ;({ options, errors } = await getCompilerOptions(resolve(`${testDir}/foobar.json`), {}, files))
    expect(options).toEqual({})
    expect(errors).toEqual([
      expect.toInclude({
        code: 5083,
        messageText: expect.toMatch(/foobar\.json/),
        category: ts.DiagnosticCategory.Error,
      }),
    ])
  })

  it('should read a basic configuration file', async () => {
    const base = resolve(`${testDir}/options/base.json`)
    let { options, errors } = await getCompilerOptions(base, {}, files)
    expect(errors).toEqual([])
    expect(options).toEqual({
      configFilePath: base,
      module: ts.ModuleKind.CommonJS,
    })


    const wrong = resolve(`${testDir}/options/wrong.json`)
    ;({ options, errors } = await getCompilerOptions(wrong, {}, files))
    expect(options).toEqual({
      configFilePath: wrong,
      module: undefined,
    })
    expect(errors).toEqual([
      expect.toInclude({
        code: 6046,
        messageText: expect.toMatch(/module/),
        category: ts.DiagnosticCategory.Error,
      }),
    ])
  })

  it('should read an extended configuration file', async () => {
    // base file
    const base = resolve(`${testDir}/options/base/tsconfig.json`)
    let { options, errors } = await getCompilerOptions(base, {}, files)
    expect(errors).toEqual([])
    expect(options).toEqual({
      module: ts.ModuleKind.AMD,
      configFilePath: base,
      outDir: resolve(`${testDir}/options/base/outDir`),
      rootDir: resolve(`${testDir}/options/base/rootDir`),
      declarationDir: resolve(`${testDir}/options/base/declarationDir`),
      rootDirs: [
        resolve(`${testDir}/options/base/rootDirs/1`),
        resolve(`${testDir}/options/base/rootDirs/2`),
      ],
      outFile: resolve(`${testDir}/options/base/outDile.js`),
    })

    // extended file (overrides module, preserves paths)
    const ext = resolve(`${testDir}/options/ext/tsconfig.json`)
    ;({ options, errors } = await getCompilerOptions(ext, {}, files))
    expect(errors).toEqual([])
    expect(options).toEqual({
      module: ts.ModuleKind.CommonJS,
      configFilePath: ext,
      outDir: resolve(`${testDir}/options/base/outDir`),
      rootDir: resolve(`${testDir}/options/base/rootDir`),
      declarationDir: resolve(`${testDir}/options/base/declarationDir`),
      rootDirs: [
        resolve(`${testDir}/options/base/rootDirs/1`),
        resolve(`${testDir}/options/base/rootDirs/2`),
      ],
      outFile: resolve(`${testDir}/options/base/outDile.js`),
    })

    // extended file with manual overrides
    ;({ options, errors } = await getCompilerOptions(ext, {
      module: ts.ModuleKind.AMD,
    }, files))

    expect(errors).toEqual([])
    expect(options).toEqual({
      module: ts.ModuleKind.AMD,
      configFilePath: ext,
      outDir: resolve(`${testDir}/options/base/outDir`),
      rootDir: resolve(`${testDir}/options/base/rootDir`),
      declarationDir: resolve(`${testDir}/options/base/declarationDir`),
      rootDirs: [
        resolve(`${testDir}/options/base/rootDirs/1`),
        resolve(`${testDir}/options/base/rootDirs/2`),
      ],
      outFile: resolve(`${testDir}/options/base/outDile.js`),
    })
  })

  it('should detect circular dependencies when reading extended configurations', async () => {
    const base = resolve(`${testDir}/options/circular/tsconfig.json`)
    const { options, errors } = await getCompilerOptions(base, {}, files)
    expect(options).toEqual({
      configFilePath: base,
    })
    expect(errors).toEqual([
      expect.toInclude({
        code: 18000,
        messageText: expect.toMatch(/^Circularity detected /),
        category: ts.DiagnosticCategory.Error,
      }),
    ])
  })
})
