import ts from 'typescript' // TypeScript does NOT support ESM modules
import { resolve } from '@plugjs/plug'

import { getCompilerOptions } from '../src/options'

describe('TypeScript Compiler Options', () => {
  it('should return the default options or fail', async () => {
    let { options, errors } = await getCompilerOptions()
    expect(options).toEqual(ts.getDefaultCompilerOptions())
    expect(errors.length).toEqual(0)


    ;({ options, errors } = await getCompilerOptions(resolve('@/foobar.json')))
    expect(options).toEqual({})
    expect(errors.length).toBe(1)
    expect(errors[0].code).toBe(5083)
    expect(errors[0].messageText).toMatch(/foobar\.json/)
    expect(errors[0].category).toBe(ts.DiagnosticCategory.Error)
  })

  it('should read a basic configuration file', async () => {
    const base = resolve('@/options/base.json')
    let { options, errors } = await getCompilerOptions(base)
    expect(errors.length).toEqual(0)
    expect(options).toEqual(Object.assign({}, ts.getDefaultCompilerOptions(), {
      configFilePath: base,
      module: ts.ModuleKind.CommonJS,
    }))


    const wrong = resolve('@/options/wrong.json')
    ;({ options, errors } = await getCompilerOptions(wrong))
    expect(options).toEqual({})
    expect(errors.length).toBe(1)
    expect(errors[0].code).toBe(6046)
    expect(errors[0].messageText).toMatch(/module/)
    expect(errors[0].category).toBe(ts.DiagnosticCategory.Error)
  })

  it('should read an extended configuration file', async () => {
    // base file
    const base = resolve('@/options/base/tsconfig.json')
    let { options, errors } = await getCompilerOptions(base)
    expect(errors.length).toEqual(0)
    expect(options).toEqual(Object.assign(ts.getDefaultCompilerOptions(), {
      module: ts.ModuleKind.AMD,
      configFilePath: base,
      outDir: resolve('@/options/base/outDir'),
      rootDir: resolve('@/options/base/rootDir'),
      declarationDir: resolve('@/options/base/declarationDir'),
      rootDirs: [
        resolve('@/options/base/rootDirs/1'),
        resolve('@/options/base/rootDirs/2'),
      ],
      outFile: resolve('@/options/base/outDile.js'),
    }))

    // extended file (overrides module, preserves paths)
    const ext = resolve('@/options/ext/tsconfig.json')
    ;({ options, errors } = await getCompilerOptions(ext))
    expect(errors.length).toEqual(0)
    expect(options).toEqual(Object.assign(ts.getDefaultCompilerOptions(), {
      module: ts.ModuleKind.CommonJS,
      configFilePath: ext,
      outDir: resolve('@/options/base/outDir'),
      rootDir: resolve('@/options/base/rootDir'),
      declarationDir: resolve('@/options/base/declarationDir'),
      rootDirs: [
        resolve('@/options/base/rootDirs/1'),
        resolve('@/options/base/rootDirs/2'),
      ],
      outFile: resolve('@/options/base/outDile.js'),
    }))

    // extended file with manual overrides
    ;({ options, errors } = await getCompilerOptions(ext, {
      module: ts.ModuleKind.AMD,
    }))

    expect(errors.length).toEqual(0)
    expect(options).toEqual(Object.assign(ts.getDefaultCompilerOptions(), {
      module: ts.ModuleKind.AMD,
      configFilePath: ext,
      outDir: resolve('@/options/base/outDir'),
      rootDir: resolve('@/options/base/rootDir'),
      declarationDir: resolve('@/options/base/declarationDir'),
      rootDirs: [
        resolve('@/options/base/rootDirs/1'),
        resolve('@/options/base/rootDirs/2'),
      ],
      outFile: resolve('@/options/base/outDile.js'),
    }))
  })

  it('should detect circular dependencies when reading extended configurations', async () => {
    const base = resolve('@/options/circular/tsconfig.json')
    const { options, errors } = await getCompilerOptions(base)
    expect(options).toEqual({})
    expect(errors.length).toEqual(1)
    expect(errors[0].code).toBe(18000)
    expect(errors[0].category).toBe(ts.DiagnosticCategory.Error)
    expect(errors[0].messageText).toBe(`Circularity detected extending from "${base}"`)
  })
})
