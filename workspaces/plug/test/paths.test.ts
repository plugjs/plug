import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'

import { BuildFailure } from '../src/asserts'
import { requireContext } from '../src/async'
import { assertAbsolutePath, assertRelativeChildPath, commonPath, getAbsoluteParent, getCurrentWorkingDirectory, isAbsolutePath, requireFilename, requireResolve, resolveAbsolutePath, resolveDirectory, resolveFile, resolveRelativeChildPath } from '../src/paths'

describe('Paths Utilities', () => {
  const { buildFile, buildDir } = requireContext()

  it('should resolve an absolute path', () => {
    expect(resolveAbsolutePath(buildDir, basename(buildFile))).toStrictlyEqual(buildFile)
    expect(() => resolveAbsolutePath('foo' as any, 'bar', 'baz'))
        .toThrowError(BuildFailure as any, 'Path "foo" not absolute')
  })

  it('should resolve a relative child path', () => {
    expect(resolveRelativeChildPath(buildDir, buildFile)).toStrictlyEqual(basename(buildFile))

    const p1 = resolveAbsolutePath(buildDir, 'foo')
    const p2 = resolveAbsolutePath(buildDir, 'bar')
    expect(resolveRelativeChildPath(p1, p2)).toStrictlyEqual(undefined)
  })


  it('should assert a relative child path', () => {
    expect(assertRelativeChildPath(buildDir, buildFile)).toStrictlyEqual(basename(buildFile))

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
    expect(assertAbsolutePath(buildDir)).toStrictlyEqual(undefined) // type assertion
    expect(() => assertAbsolutePath('foobar')) // type assertion
        .toThrowError(BuildFailure as any, 'Path "foobar" not absolute')
  })

  it('should get the parent of an absolute path', () => {
    expect(getAbsoluteParent(buildFile)).toStrictlyEqual(buildDir)
    expect(() => getAbsoluteParent('foobar' as any))
        .toThrowError(BuildFailure as any, 'Path "foobar" not absolute')
  })

  it('should get the current working directory', () => {
    expect(getCurrentWorkingDirectory()).toStrictlyEqual(process.cwd())
  })

  it('should find the common path amongst multiple paths', () => {
    const p1 = resolveAbsolutePath(buildDir, 'foo')
    const p2 = resolveAbsolutePath(buildDir, 'bar')
    const p3 = 'baz' // relative!

    expect(commonPath(p1, p2, p3)).toStrictlyEqual(buildDir)
  })

  /* ======================================================================== *
   * MODULE RESOLUTION FUNCTIONS                                              *
   * ======================================================================== */

  it('should return the resolved path of a script', () => {
    const buildUrl = pathToFileURL(buildFile).href
    const resolvedFile = resolveAbsolutePath(buildDir, 'foobar.ts')

    expect(requireFilename(buildFile)).toStrictlyEqual(buildFile)
    expect(requireFilename(buildUrl)).toStrictlyEqual(buildFile)

    expect(requireFilename(buildFile, 'foobar.ts')).toStrictlyEqual(resolvedFile)
    expect(requireFilename(buildUrl, 'foobar.ts')).toStrictlyEqual(resolvedFile)
  })

  it('should return the module name to require / import', () => {
    expect(requireResolve(buildFile, './workspaces/plug/src/index.ts'))
        .toStrictlyEqual(resolveAbsolutePath(buildDir, 'workspaces', 'plug', 'src', 'index.ts'))
    expect(requireResolve(buildFile, './workspaces/plug//src/index')) // no extension
        .toStrictlyEqual(resolveAbsolutePath(buildDir, 'workspaces', 'plug', 'src', 'index.ts'))
    expect(requireResolve(buildFile, './workspaces/plug/src')) // directory index!
        .toStrictlyEqual(resolveAbsolutePath(buildDir, 'workspaces', 'plug', 'src', 'index.ts'))
    expect(requireResolve(buildFile, './workspaces/plug/src/')) // directory with slash
        .toStrictlyEqual(resolveAbsolutePath(buildDir, 'workspaces', 'plug', 'src', 'index.ts'))

    // straight up modules!
    expect(requireResolve(buildFile, 'typescript')).toBeA('string')
    expect(() => requireResolve(buildFile, '@plugjs/this-does-not-exist'))
        .toThrowError(/@plugjs\/this-does-not-exist/)
  })

  /* ======================================================================== *
   * FILE CHECKING FUNCTIONS                                                  *
   * ======================================================================== */

  it('should check for the existance of a file', () => {
    expect(resolveFile(buildFile)).toStrictlyEqual(buildFile)
    expect(resolveFile(buildDir, 'this-does-not-exist')).toStrictlyEqual(undefined)
    expect(resolveFile(buildDir)).toStrictlyEqual(undefined) // wrong type!
  })

  it('should check for the existance of a directory', () => {
    expect(resolveDirectory(buildDir)).toStrictlyEqual(buildDir)
    expect(resolveDirectory(buildDir, 'this-does-not-exist')).toStrictlyEqual(undefined)
    expect(resolveDirectory(buildFile)).toStrictlyEqual(undefined) // wrong type!
  })
})
