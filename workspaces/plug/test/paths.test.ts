import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'

import { BuildFailure } from '../src/asserts'
import { requireContext } from '../src/async'
import { assertAbsolutePath, assertRelativeChildPath, commonPath, getAbsoluteParent, getCurrentWorkingDirectory, isAbsolutePath, requireFilename, requireResolve, resolveAbsolutePath, resolveDirectory, resolveFile, resolveRelativeChildPath } from '../src/paths'

describe('Paths Utilities', () => {
  const { buildFile, buildDir } = requireContext()

  it('should resolve an absolute path', () => {
    expect(resolveAbsolutePath(buildDir, basename(buildFile))).toBe(buildFile)
    expect(() => resolveAbsolutePath('foo' as any, 'bar', 'baz'))
        .toThrowError(BuildFailure as any, 'Path "foo" not absolute')
  })

  it('should resolve a relative child path', () => {
    expect(resolveRelativeChildPath(buildDir, buildFile)).toBe(basename(buildFile))

    const p1 = resolveAbsolutePath(buildDir, 'foo')
    const p2 = resolveAbsolutePath(buildDir, 'bar')
    expect(resolveRelativeChildPath(p1, p2)).toBe(undefined)
  })


  it('should assert a relative child path', () => {
    expect(assertRelativeChildPath(buildDir, buildFile)).toBe(basename(buildFile))

    const p1 = resolveAbsolutePath(buildDir, 'foo')
    const p2 = resolveAbsolutePath(buildDir, 'bar')
    expect(() => assertRelativeChildPath(p1, p2))
        .toThrowError(BuildFailure as any, `Path "${p2}" not relative to "${p1}"`)
  })

  it('should check if a path is absolute', () => {
    expect(isAbsolutePath(buildDir)).toBeTrue() // type guard
    expect(isAbsolutePath('foobar')).toBeFalse() // type guard
  })

  it('should assert that a path is absolute', () => {
    expect(assertAbsolutePath(buildDir)).toBe(undefined) // type assertion
    expect(() => assertAbsolutePath('foobar')) // type assertion
        .toThrowError(BuildFailure as any, 'Path "foobar" not absolute')
  })

  it('should get the parent of an absolute path', () => {
    expect(getAbsoluteParent(buildFile)).toBe(buildDir)
    expect(() => getAbsoluteParent('foobar' as any))
        .toThrowError(BuildFailure as any, 'Path "foobar" not absolute')
  })

  it('should get the current working directory', () => {
    expect(getCurrentWorkingDirectory()).toBe(process.cwd())
  })

  it('should find the common path amongst multiple paths', () => {
    const p1 = resolveAbsolutePath(buildDir, 'foo')
    const p2 = resolveAbsolutePath(buildDir, 'bar')
    const p3 = 'baz' // relative!

    expect(commonPath(p1, p2, p3)).toBe(buildDir)
  })

  /* ======================================================================== *
   * MODULE RESOLUTION FUNCTIONS                                              *
   * ======================================================================== */

  it('should return the resolved path of a script', () => {
    const buildUrl = pathToFileURL(buildFile).href
    const resolvedFile = resolveAbsolutePath(buildDir, 'foobar.ts')

    expect(requireFilename(buildFile)).toBe(buildFile)
    expect(requireFilename(buildUrl)).toBe(buildFile)

    expect(requireFilename(buildFile, 'foobar.ts')).toBe(resolvedFile)
    expect(requireFilename(buildUrl, 'foobar.ts')).toBe(resolvedFile)
  })

  it('should return the module name to require / import', () => {
    expect(requireResolve(buildFile, '../src/index.ts'))
        .toBe(resolveAbsolutePath(buildDir, '..', 'src', 'index.ts'))
    expect(requireResolve(buildFile, '../src/index')) // no extension
        .toBe(resolveAbsolutePath(buildDir, '..', 'src', 'index.ts'))
    expect(requireResolve(buildFile, '../src')) // directory index!
        .toBe(resolveAbsolutePath(buildDir, '..', 'src', 'index.ts'))
    expect(requireResolve(buildFile, '../src/')) // directory with slash
        .toBe(resolveAbsolutePath(buildDir, '..', 'src', 'index.ts'))

    // straight up modules!
    expect(requireResolve(buildFile, 'typescript')).toEqual(jasmine.any(String))
    expect(() => requireResolve(buildFile, '@plugjs/this-does-not-exist'))
        .toThrowError(/@plugjs\/this-does-not-exist/)
  })

  /* ======================================================================== *
   * FILE CHECKING FUNCTIONS                                                  *
   * ======================================================================== */

  it('should check for the existance of a file', () => {
    expect(resolveFile(buildFile)).toBe(buildFile)
    expect(resolveFile(buildDir, 'this-does-not-exist')).toBe(undefined)
    expect(resolveFile(buildDir)).toBe(undefined) // wrong type!
  })

  it('should check for the existance of a directory', () => {
    expect(resolveDirectory(buildDir)).toBe(buildDir)
    expect(resolveDirectory(buildDir, 'this-does-not-exist')).toBe(undefined)
    expect(resolveDirectory(buildFile)).toBe(undefined) // wrong type!
  })
})
