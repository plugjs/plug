import { requireContext } from '../src/async'
import { Files } from '../src/files'
import { exec, find, isDirectory, isFile, merge, noop, resolve } from '../src/helpers'

// only the ones we don't normally use in our build
describe('Helpers Test', () => {
  const { buildFile, buildDir } = requireContext()

  it('should check for the existance of a file', () => {
    expect(isFile(buildFile)).toStrictlyEqual(buildFile)
    expect(isFile(buildDir, 'this-does-not-exist')).toStrictlyEqual(undefined)
    expect(isFile(buildDir)).toStrictlyEqual(undefined) // wrong type!
  })

  it('should check for the existance of a directory', () => {
    expect(isDirectory(buildDir)).toStrictlyEqual(buildDir)
    expect(isDirectory(buildDir, 'this-does-not-exist')).toStrictlyEqual(undefined)
    expect(isDirectory(buildFile)).toStrictlyEqual(undefined) // wrong type!
  })

  it('should find files in the current directory', async () => {
    const files = await find('--nope--')
    expect(files.length).toEqual(0)
    expect(files.directory).toEqual(process.cwd())
  })

  it('should create an empty pipe', async () => {
    const pipe1 = noop()
    expect(pipe1.plug).toBeA('function')
    const files1 = await pipe1
    expect(files1.length).toStrictlyEqual(0)
    expect(files1.directory).toStrictlyEqual(resolve('.'))

    const pipe2 = merge([])
    expect(pipe2.plug).toBeA('function')
    const files2 = await pipe2
    expect(files2.length).toStrictlyEqual(0)
    expect(files2.directory).toStrictlyEqual(resolve('.'))

    const pipe3 = merge([ new Files(resolve('@')) ])
    expect(pipe3.plug).toBeA('function')
    const files3 = await pipe2
    expect(files3.length).toStrictlyEqual(0)
    expect(files3.directory).toStrictlyEqual(resolve('.'))
    expect(files3.directory).not.toStrictlyEqual(resolve('@'))
  })

  it('should merge two pipes', async () => {
    const pipe1 = find('**/*.*', { directory: '@/../src' })
    const pipe2 = find('**/*.*', { directory: '@/../test' })
    const pipe = merge([ pipe1, pipe2 ])

    const files1 = await pipe1
    const files2 = await pipe2
    expect(files1.length).toBeGreaterThan(0)
    expect(files2.length).toBeGreaterThan(0)
    expect(files1.length).not.toEqual(files2.length)
    expect(files2.directory).not.toEqual(files1.directory)

    const files = await pipe
    expect(files.length).toEqual(files1.length + files2.length)
    expect(files.directory).not.toEqual(files1.directory)
    expect(files.directory).not.toEqual(files2.directory)
    expect(files.directory).toEqual(resolve('@/..'))

    expect([ ...files.absolutePaths() ]).toEqual([
      ...files1.absolutePaths(),
      ...files2.absolutePaths(),
    ])
  })

  it('should execute a process', async () => {
    await expect(exec('true')).toBeResolved()
    await expect(exec('false')).toBeRejected()

    await expect(exec('exit 0')).toBeRejected() // sans shell
    await expect(exec('exit 0', { shell: true })).toBeResolved() // with shell
    await expect(exec('exit 1', { shell: true })).toBeRejected() // with shell
  })
})
