import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'

import { expect } from 'chai'

import { requireContext } from '../src/async'
import { assertAbsolutePath, assertRelativeChildPath, commonPath, getAbsoluteParent, getCurrentWorkingDirectory, isAbsolutePath, requireFilename, requireResolve, resolveAbsolutePath, resolveDirectory, resolveFile, resolveRelativeChildPath } from '../src/paths'
import { BuildFailure } from '../src/asserts'

describe('Paths Utilities', () => {
  const { buildFile, buildDir } = requireContext()

  it('should resolve an absolute path', () => {
    expect(resolveAbsolutePath(buildDir, basename(buildFile))).to.equal(buildFile)
    expect(() => resolveAbsolutePath('foo' as any, 'bar', 'baz'))
        .to.throw(BuildFailure, 'Path "foo" not absolute')
  })

  it('should resolve a relative child path', () => {
    expect(resolveRelativeChildPath(buildDir, buildFile)).to.equal(basename(buildFile))

    const p1 = resolveAbsolutePath(buildDir, 'foo')
    const p2 = resolveAbsolutePath(buildDir, 'bar')
    expect(resolveRelativeChildPath(p1, p2)).to.be.undefined
  })


  it('should assert a relative child path', () => {
    expect(assertRelativeChildPath(buildDir, buildFile)).to.equal(basename(buildFile))

    const p1 = resolveAbsolutePath(buildDir, 'foo')
    const p2 = resolveAbsolutePath(buildDir, 'bar')
    expect(() => assertRelativeChildPath(p1, p2))
        .to.throw(BuildFailure, `Path "${p2}" not relative to "${p1}"`)
  })

  it('should check if a path is absolute', () => {
    expect(isAbsolutePath(buildDir)).to.be.true // type guard
    expect(isAbsolutePath('foobar')).to.be.false // type guard
  })

  it('should assert that a path is absolute', () => {
    expect(assertAbsolutePath(buildDir)).to.be.undefined // type assertion
    expect(() => assertAbsolutePath('foobar')) // type assertion
        .to.throw(BuildFailure, 'Path "foobar" not absolute')
  })

  it('should get the parent of an absolute path', () => {
    expect(getAbsoluteParent(buildFile)).to.equal(buildDir)
    expect(() => getAbsoluteParent('foobar' as any))
        .to.throw(BuildFailure, 'Path "foobar" not absolute')
  })

  it('should get the current working directory', () => {
    expect(getCurrentWorkingDirectory()).to.equal(process.cwd())
  })

  it('should find the common path amongst multiple paths', () => {
    const p1 = resolveAbsolutePath(buildDir, 'foo')
    const p2 = resolveAbsolutePath(buildDir, 'bar')
    const p3 = 'baz' // relative!

    expect(commonPath(p1, p2, p3)).to.equal(buildDir)
  })

  /* ======================================================================== *
   * MODULE RESOLUTION FUNCTIONS                                              *
   * ======================================================================== */

  it('should return the resolved path of a script', () => {
    const buildUrl = pathToFileURL(buildFile).href
    const resolvedFile = resolveAbsolutePath(buildDir, 'foobar.ts')

    expect(requireFilename(buildFile)).to.equal(buildFile)
    expect(requireFilename(buildUrl)).to.equal(buildFile)

    expect(requireFilename(buildFile, 'foobar.ts')).to.equal(resolvedFile)
    expect(requireFilename(buildUrl, 'foobar.ts')).to.equal(resolvedFile)
  })

  it('should return the module name to require / import', () => {
    expect(requireResolve(buildFile, './src/index.ts'))
        .to.equal(resolveAbsolutePath(buildDir, 'src', 'index.ts'))
    expect(requireResolve(buildFile, './src/index')) // no extension
        .to.equal(resolveAbsolutePath(buildDir, 'src', 'index.ts'))
    expect(requireResolve(buildFile, './src')) // directory index!
        .to.equal(resolveAbsolutePath(buildDir, 'src', 'index.ts'))
    expect(requireResolve(buildFile, './src/')) // directory with slash
        .to.equal(resolveAbsolutePath(buildDir, 'src', 'index.ts'))

    // straight up modules!
    expect(requireResolve(buildFile, 'typescript')).to.be.a.string
    expect(() => requireResolve(buildFile, '@plugjs/this-does-not-exist'))
        .to.throw('@plugjs/this-does-not-exist')
  })

  /* ======================================================================== *
   * FILE CHECKING FUNCTIONS                                                  *
   * ======================================================================== */

  it('should check for the existance of a file', () => {
    expect(resolveFile(buildFile)).to.equal(buildFile)
    expect(resolveFile(buildDir, 'this-does-not-exist')).to.be.undefined
    expect(resolveFile(buildDir)).to.be.undefined // wrong type!
  })

  it('should check for the existance of a directory', () => {
    expect(resolveDirectory(buildDir)).to.equal(buildDir)
    expect(resolveDirectory(buildDir, 'this-does-not-exist')).to.be.undefined
    expect(resolveDirectory(buildFile)).to.be.undefined // wrong type!
  })
})
