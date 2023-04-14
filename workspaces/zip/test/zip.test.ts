import assert from 'node:assert'

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
    expect(paths).toEqual(jasmine.arrayWithExactContents([ outfile ]))

    const entries: string[] = []

    await new Promise((resolve, reject) => {
      yauzl.open(outfile, (error, zipfile) => {
        if (error) return reject(error)
        zipfile.on('entry', (entry: yauzl.Entry) => entries.push(entry.fileName))
        zipfile.on('error', reject)
        zipfile.on('end', resolve)
      })
    })

    expect(entries.sort()).toEqual(jasmine.arrayWithExactContents([
      'build.ts',
      'zip.test.ts',
    ]))
  })

  it('should zip contents of this directory from the parent', async () => {
    const outfile = resolve(outdir, 'zipfile2.zip')

    const files = await find('test/*.ts', { directory: '@/..' }).plug(new Zip(outfile))
    const paths = [ ...files.absolutePaths() ]

    expect(files.directory).toEqual(outdir)
    expect(paths).toEqual(jasmine.arrayWithExactContents([ outfile ]))

    const entries: string[] = []

    await new Promise((resolve, reject) => {
      yauzl.open(outfile, (error, zipfile) => {
        if (error) return reject(error)
        zipfile.on('entry', (entry: yauzl.Entry) => entries.push(entry.fileName))
        zipfile.on('error', reject)
        zipfile.on('end', resolve)
      })
    })

    expect(entries.sort()).toEqual(jasmine.arrayWithExactContents([
      'test/build.ts',
      'test/zip.test.ts',
    ]))
  })

  it('should install the "zip" plug', async () => {
    const pipe1 = merge([])
    assert(typeof pipe1.zip === 'undefined', 'Zip already installed')
    await import('../src/index')
    const pipe2 = merge([])
    assert(typeof pipe2.zip === 'function', 'Zip not installed')
  })
})
