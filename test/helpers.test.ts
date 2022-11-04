import { expect } from 'chai'

import { exec, isDirectory, isFile, merge, noop, resolve } from '../src/helpers'
import { requireContext } from '../src/async'

// only the ones we don't normally use in our build
describe('Helpers Test', () => {
  const { buildFile, buildDir } = requireContext()

  it('should check for the existance of a file', () => {
    expect(isFile(buildFile)).to.equal(buildFile)
    expect(isFile(buildDir, 'this-does-not-exist')).to.be.undefined
    expect(isFile(buildDir)).to.be.undefined // wrong type!
  })

  it('should check for the existance of a directory', () => {
    expect(isDirectory(buildDir)).to.equal(buildDir)
    expect(isDirectory(buildDir, 'this-does-not-exist')).to.be.undefined
    expect(isDirectory(buildFile)).to.be.undefined // wrong type!
  })

  it('should create an empty pipe', async () => {
    const pipe1 = noop()
    expect(pipe1.plug).to.be.a('function')
    const files1 = await pipe1
    expect(files1.length).to.equal(0)
    expect(files1.directory).to.equal(resolve('.'))

    const pipe2 = merge([])
    expect(pipe2.plug).to.be.a('function')
    const files2 = await pipe2
    expect(files2.length).to.equal(0)
    expect(files2.directory).to.equal(resolve('.'))
  })

  it('should execute a process', async () => {
    await expect(exec('true')).to.be.fulfilled
    await expect(exec('false')).to.be.rejected

    await expect(exec('exit 0')).to.be.rejected // sans shell
    await expect(exec('exit 0', { shell: true })).to.be.fulfilled // with shell
    await expect(exec('exit 1', { shell: true })).to.be.rejected // with shell
  })
})
