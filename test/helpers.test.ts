import { exec, isDirectory, isFile, merge, noop, resolve } from '../src/helpers'
import { requireContext } from '../src/async'

// only the ones we don't normally use in our build
describe('Helpers Test', () => {
  const { buildFile, buildDir } = requireContext()

  it('should check for the existance of a file', () => {
    expect(isFile(buildFile)).toBe(buildFile)
    expect(isFile(buildDir, 'this-does-not-exist')).toBe(undefined)
    expect(isFile(buildDir)).toBe(undefined) // wrong type!
  })

  it('should check for the existance of a directory', () => {
    expect(isDirectory(buildDir)).toBe(buildDir)
    expect(isDirectory(buildDir, 'this-does-not-exist')).toBe(undefined)
    expect(isDirectory(buildFile)).toBe(undefined) // wrong type!
  })

  it('should create an empty pipe', async () => {
    const pipe1 = noop()
    expect(pipe1.plug).toEqual(jasmine.any(Function))
    const files1 = await pipe1
    expect(files1.length).toBe(0)
    expect(files1.directory).toBe(resolve('.'))

    const pipe2 = merge([])
    expect(pipe2.plug).toEqual(jasmine.any(Function))
    const files2 = await pipe2
    expect(files2.length).toBe(0)
    expect(files2.directory).toBe(resolve('.'))
  })

  it('should execute a process', async () => {
    await expectAsync(exec('true')).toBeResolved()
    await expectAsync(exec('false')).toBeRejected()

    await expectAsync(exec('exit 0')).toBeRejected() // sans shell
    await expectAsync(exec('exit 0', { shell: true })).toBeResolved() // with shell
    await expectAsync(exec('exit 1', { shell: true })).toBeRejected() // with shell
  })
})
