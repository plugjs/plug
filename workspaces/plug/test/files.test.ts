import { inspect } from 'node:util'

import { Files } from '../src/files'
import { readFile } from '../src/fs'
import { mkdtemp, rmrf } from '../src/index'
import { getCurrentWorkingDirectory, resolveAbsolutePath } from '../src/paths'

import type { AbsolutePath } from '../src/paths'

describe('Files Collection', () => {
  let tempdir: AbsolutePath

  beforeAll(() => void (tempdir = mkdtemp()))
  afterAll(() => rmrf(tempdir))

  it('should create an empty Files instance', () => {
    const files1 = new Files()
    expect(files1.length).toStrictlyEqual(0)
    expect(files1.directory).toStrictlyEqual(getCurrentWorkingDirectory())
    expect([ ...files1 ]).toEqual([])
    expect([ ...files1.absolutePaths() ]).toEqual([])
    expect([ ...files1.pathMappings() ]).toEqual([])

    const files2 = new Files(tempdir)
    expect(files2.length).toStrictlyEqual(0)
    expect(files2.directory).toStrictlyEqual(tempdir)
    expect([ ...files2 ]).toEqual([])
    expect([ ...files2.absolutePaths() ]).toEqual([])
    expect([ ...files2.pathMappings() ]).toEqual([])

    const files3 = Files.builder().build()
    expect(files3.length).toStrictlyEqual(0)
    expect(files3.directory).toStrictlyEqual(getCurrentWorkingDirectory())
    expect([ ...files3 ]).toEqual([])
    expect([ ...files3.absolutePaths() ]).toEqual([])
    expect([ ...files3.pathMappings() ]).toEqual([])

    const files4 = Files.builder(tempdir).build()
    expect(files4.length).toStrictlyEqual(0)
    expect(files4.directory).toStrictlyEqual(tempdir)
    expect([ ...files4 ]).toEqual([])
    expect([ ...files4.absolutePaths() ]).toEqual([])
    expect([ ...files4.pathMappings() ]).toEqual([])
  })

  it('should use a builder to create a Files instance', () => {
    const builder1 = Files.builder(tempdir)
    builder1.add('foo')
    builder1.add('bar')
    const files1 = builder1.build()

    // remember, alphabetical order

    expect(files1.length).toStrictlyEqual(2)
    expect(files1.directory).toStrictlyEqual(tempdir)
    expect([ ...files1 ]).toEqual([ 'bar', 'foo' ])
    expect([ ...files1.absolutePaths() ]).toEqual([
      `${tempdir}/bar`,
      `${tempdir}/foo`,
    ] as AbsolutePath[])
    expect([ ...files1.pathMappings() ]).toEqual([
      [ 'bar', `${tempdir}/bar` ],
      [ 'foo', `${tempdir}/foo` ],
    ] as [ string, AbsolutePath ][])

    const inspect1 = (<any> files1)[inspect.custom]()
    expect(inspect1).toEqual({
      directory: tempdir,
      files: [ 'bar', 'foo' ],
    })

    // merge and add files to the second instance

    const builder2 = Files.builder(files1)
    builder2.add('baz')
    const files2 = builder2.build()

    expect(files2.length).toStrictlyEqual(3)
    expect(files2.directory).toStrictlyEqual(tempdir)
    expect([ ...files2 ]).toEqual([ 'bar', 'baz', 'foo' ])
    expect([ ...files2.absolutePaths() ]).toEqual([
      `${tempdir}/bar`,
      `${tempdir}/baz`,
      `${tempdir}/foo`,
    ] as AbsolutePath[])
    expect([ ...files2.pathMappings() ]).toEqual([
      [ 'bar', `${tempdir}/bar` ],
      [ 'baz', `${tempdir}/baz` ],
      [ 'foo', `${tempdir}/foo` ],
    ] as [ string, AbsolutePath ][])

    const inspect2 = (<any> files2)[inspect.custom]()
    expect(inspect2).toEqual({
      directory: tempdir,
      files: [ 'bar', 'baz', 'foo' ],
    })
  })

  it('should merge two separate Files instance', () => {
    const builder1 = Files.builder(resolveAbsolutePath(tempdir, 'baz'))
    builder1.add('foo')
    builder1.add('bar')
    const files1 = builder1.build()

    const builder2 = Files.builder(tempdir)
    builder2.add('hello')
    builder2.add('world')
    builder2.merge(files1)
    const files2 = builder2.build()

    expect([ ...files2.pathMappings() ]).toEqual([
      [ 'baz/bar', `${tempdir}/baz/bar` ],
      [ 'baz/foo', `${tempdir}/baz/foo` ],
      [ 'hello', `${tempdir}/hello` ],
      [ 'world', `${tempdir}/world` ],
    ] as [ string, AbsolutePath ][])
  })


  it('should write a file while building', async () => {
    const builder1 = Files.builder(tempdir)
    await builder1.write('file.bin', Buffer.from('CAFEBABE', 'hex'))
    await builder1.write('file.txt', 'Hello, world!')
    const files1 = builder1.build()

    expect(files1.length).toStrictlyEqual(2)
    expect(files1.directory).toStrictlyEqual(tempdir)
    expect([ ...files1 ]).toEqual([ 'file.bin', 'file.txt' ])
    expect([ ...files1.absolutePaths() ]).toEqual([
      `${tempdir}/file.bin`,
      `${tempdir}/file.txt`,
    ] as AbsolutePath[])
    expect([ ...files1.pathMappings() ]).toEqual([
      [ 'file.bin', `${tempdir}/file.bin` ],
      [ 'file.txt', `${tempdir}/file.txt` ],
    ] as [ string, AbsolutePath ][])

    expect(await readFile(`${tempdir}/file.bin`, 'hex')).toStrictlyEqual('cafebabe')
    expect(await readFile(`${tempdir}/file.txt`, 'utf8')).toStrictlyEqual('Hello, world!')
  })
})
