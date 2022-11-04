import { inspect } from 'node:util'

import { expect } from 'chai'

import { Files } from '../src/files'
import { readFile } from '../src/fs'
import { mkdtemp, rmrf } from '../src/index'

import type { AbsolutePath } from '../src/paths'

describe('Files Collection', () => {
  let tempdir: AbsolutePath

  before(() => void (tempdir = mkdtemp()))
  after(() => rmrf(tempdir))

  it('should create an empty Files instance', () => {
    const files = new Files(tempdir)
    expect(files.length).to.equal(0)
    expect(files.directory).to.equal(tempdir)
    expect([ ...files ]).to.eql([])
    expect([ ...files.absolutePaths() ]).to.eql([])
    expect([ ...files.pathMappings() ]).to.eql([])
  })

  it('should use a builder to create a Files instance', () => {
    const builder1 = Files.builder(tempdir)
    builder1.add('foo')
    builder1.add('bar')
    const files1 = builder1.build()

    // remember, alphabetical order

    expect(files1.length).to.equal(2)
    expect(files1.directory).to.equal(tempdir)
    expect([ ...files1 ]).to.eql([ 'bar', 'foo' ])
    expect([ ...files1.absolutePaths() ]).to.eql([
      `${tempdir}/bar`,
      `${tempdir}/foo`,
    ])
    expect([ ...files1.pathMappings() ]).to.eql([
      [ 'bar', `${tempdir}/bar` ],
      [ 'foo', `${tempdir}/foo` ],
    ])

    const inspect1 = (<any> files1)[inspect.custom]()
    expect(inspect1).to.eql({
      directory: tempdir,
      files: [ 'bar', 'foo' ],
    })

    // merge and add files to the second instance

    const builder2 = Files.builder(files1)
    builder2.add('baz')
    const files2 = builder2.build()

    expect(files2.length).to.equal(3)
    expect(files2.directory).to.equal(tempdir)
    expect([ ...files2 ]).to.eql([ 'bar', 'baz', 'foo' ])
    expect([ ...files2.absolutePaths() ]).to.eql([
      `${tempdir}/bar`,
      `${tempdir}/baz`,
      `${tempdir}/foo`,
    ])
    expect([ ...files2.pathMappings() ]).to.eql([
      [ 'bar', `${tempdir}/bar` ],
      [ 'baz', `${tempdir}/baz` ],
      [ 'foo', `${tempdir}/foo` ],
    ])

    const inspect2 = (<any> files2)[inspect.custom]()
    expect(inspect2).to.eql({
      directory: tempdir,
      files: [ 'bar', 'baz', 'foo' ],
    })
  })

  it('should write a file while building', async () => {
    const builder1 = Files.builder(tempdir)
    await builder1.write('file.bin', Buffer.from('CAFEBABE', 'hex'))
    await builder1.write('file.txt', 'Hello, world!')
    const files1 = builder1.build()

    expect(files1.length).to.equal(2)
    expect(files1.directory).to.equal(tempdir)
    expect([ ...files1 ]).to.eql([ 'file.bin', 'file.txt' ])
    expect([ ...files1.absolutePaths() ]).to.eql([
      `${tempdir}/file.bin`,
      `${tempdir}/file.txt`,
    ])
    expect([ ...files1.pathMappings() ]).to.eql([
      [ 'file.bin', `${tempdir}/file.bin` ],
      [ 'file.txt', `${tempdir}/file.txt` ],
    ])

    expect(await readFile(`${tempdir}/file.bin`, 'hex')).to.equal('cafebabe')
    expect(await readFile(`${tempdir}/file.txt`, 'utf8')).to.equal('Hello, world!')
  })
})
