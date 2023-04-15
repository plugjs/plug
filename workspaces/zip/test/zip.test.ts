import { find, merge, mkdtemp, resolve, rmrf } from '@plugjs/plug'
import * as yauzl from 'yauzl'

import { Zip } from '../src/zip'

import type { AbsolutePath } from '@plugjs/plug'

describe('Zip Files', () => {
  let outdir: AbsolutePath

  beforeAll(() => {
    outdir = mkdtemp()
  })

  afterAll(async () => {
    await rmrf(outdir)
  })

  it('should zip this directory', async () => {
    const outfile = resolve(outdir, 'zipfile1.zip')

    const files = await find('*.ts', { directory: '@' }).plug(new Zip(outfile))
    const paths = [ ...files.absolutePaths() ]

    expect(files.directory).toEqual(outdir)
    expect(paths).toEqual(expect.toInclude([ outfile ]))

    const entries = new Set<string>()

    await new Promise((resolve, reject) => {
      yauzl.open(outfile, (error, zipfile) => {
        if (error) return reject(error)
        zipfile.on('entry', (entry: yauzl.Entry) => entries.add(entry.fileName))
        zipfile.on('error', reject)
        zipfile.on('end', resolve)
      })
    })

    expect(entries).toEqual(new Set([
      'build.ts',
      'zip.test.ts',
    ]))
  })

  it('should zip contents of this directory from the parent', async () => {
    const outfile = resolve(outdir, 'zipfile2.zip')

    const files = await find('test/*.ts', { directory: '@/..' }).plug(new Zip(outfile))
    const paths = [ ...files.absolutePaths() ]

    expect(files.directory).toEqual(outdir)
    expect(paths).toEqual([ outfile ])

    const entries = new Set<string>()

    await new Promise((resolve, reject) => {
      yauzl.open(outfile, (error, zipfile) => {
        if (error) return reject(error)
        zipfile.on('entry', (entry: yauzl.Entry) => entries.add(entry.fileName))
        zipfile.on('error', reject)
        zipfile.on('end', resolve)
      })
    })

    expect(entries).toEqual(new Set([
      'test/build.ts',
      'test/zip.test.ts',
    ]))
  })

  it('should install the "zip" plug', async () => {
    expect(merge([]).zip).toBeUndefined()
    await import('../src/index')
    expect(merge([]).zip).toBeA('function')
  })
})
