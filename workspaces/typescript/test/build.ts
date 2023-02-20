import assert from 'node:assert'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import '@plugjs/jasmine'
import { build, find, merge, resolve, rmrf } from '@plugjs/plug'
import { Files } from '@plugjs/plug/files'
import { mkdtemp } from '@plugjs/plug/fs'
import ts from 'typescript'

import { Tsc } from '../src/typescript'


export default build({
  async test_simple() {
    await find('**/*.ts', { directory: '@/data' })
        .plug(new Tsc())
        .then((r) => assert(r.length === 0, 'Files produced???'))
  },

  async test_bad_cfg() {
    await find('**/*.ts', { directory: '@/data' })
        .plug(new Tsc('@/data/bad.tsconfig.json'))
        .then(() => assert(false, 'This should fail'), () => void 0)
  },

  async test_types() {
    await find('**/*.ts', { directory: '@/extra/src' })
        .plug(new Tsc())
        .then(() => assert(false, 'This should fail'), () => void 0)

    await find('**/*.ts', { directory: '@/extra/src' })
        .plug(new Tsc({ extraTypesDir: '@/extra/types' }))
        .then((r) => assert(r.length === 0, 'Files produced???'))
  },

  async test_no_file() {
    const files = Files.builder(resolve('@/data')).add('missing.ts').build()
    const pipe = merge([ files ])

    await pipe.plug(new Tsc())
        .then(() => assert(false, 'This should fail'), () => void 0)
  },

  async test_base() {
    const dir = await mkdtemp(join(tmpdir(), 'plug-'))
    try {
      await find('**/*.ts', { directory: '@/data' })
          .plug(new Tsc({
            outDir: dir,
            noEmit: false,
            declaration: true,
          }))

      const files = [ ...await find('**', { directory: dir }) ].sort()
      assert.deepEqual(files, [
        'empty.d.ts',
        'empty.js',
        'simple.d.ts',
        'simple.js',
      ].sort())
    } finally {
      await rmrf(dir)
    }
  },

  async test_outfile() {
    const dir = await mkdtemp(join(tmpdir(), 'plug-'))
    const file = join(dir, 'output.js')
    try {
      await find('**/*.ts', { directory: '@/data' })
          .plug(new Tsc({
            module: ts.ModuleKind.AMD,
            outDir: dir,
            outFile: file,
            noEmit: false,
            declaration: true,
          }))

      const files = [ ...await find('**', { directory: dir }) ].sort()
      assert.deepEqual(files, [
        'output.d.ts',
        'output.js',
      ].sort())
    } finally {
      await rmrf(dir)
    }
  },

  async test_rootdir() {
    const dir = await mkdtemp(join(tmpdir(), 'plug-'))
    try {
      await find('**/*.ts', { directory: '@/data' })
          .plug(new Tsc({
            outDir: dir,
            noEmit: false,
            declaration: true,
            rootDir: '@',
          }))

      const files = [ ...await find('**', { directory: dir }) ].sort()
      assert.deepEqual(files, [
        'data/empty.d.ts',
        'data/empty.js',
        'data/simple.d.ts',
        'data/simple.js',
      ].sort())
    } finally {
      await rmrf(dir)
    }
  },

  async test_rootdirs() {
    const dir = await mkdtemp(join(tmpdir(), 'plug-'))
    try {
      await find('**/*.ts', { directory: '@/rootdirs' })
          .plug(new Tsc())
          .then(() => assert(false, 'This should fail'), () => void 0)

      await find('**/*.ts', { directory: '@/rootdirs' })
          .plug(new Tsc({
            outDir: dir,
            noEmit: false,
            declaration: false,
            rootDirs: [ '@/rootdirs/a', '@/rootdirs/b' ],
          }))

      const files = [ ...await find('**', { directory: dir }) ].sort()
      assert.deepEqual(files, [
        'a/one.js',
        'b/two.js',
      ].sort())
    } finally {
      await rmrf(dir)
    }
  },

  async test_baseurl() {
    const dir = await mkdtemp(join(tmpdir(), 'plug-'))
    try {
      await find('**/*.ts', { directory: '@/baseurl' })
          .plug(new Tsc())
          .then(() => assert(false, 'This should fail'), () => void 0)

      await find('**/*.ts', { directory: '@/baseurl' })
          .plug(new Tsc({
            outDir: dir,
            noEmit: false,
            declaration: false,
            rootDir: '@/baseurl',
            baseUrl: '@/baseurl/a',
          }))

      const files = [ ...await find('**', { directory: dir }) ].sort()
      assert.deepEqual(files, [
        'a/one.js',
        'b/two.js',
      ].sort())
    } finally {
      // await rmrf(dir)
    }
  },

  async test_install() {
    const pipe1 = merge([])
    assert(typeof pipe1.tsc === 'undefined', 'Typescript already installed')
    // @ts-ignore
    await import('../src/index')
    const pipe2 = merge([])
    assert(typeof pipe2.tsc === 'function', 'Typescript not installed')
  },

  async test_options() {
    await find('options.test.ts', { directory: '@' }).jasmine()
  },

  async test(): Promise<void> {
    await this.test_outfile()

    await this.test_simple()
    await this.test_bad_cfg()
    await this.test_types()
    await this.test_no_file()
    await this.test_base()
    await this.test_rootdir()
    await this.test_rootdirs()
    await this.test_baseurl()

    await this.test_options()

    await this.test_install()
  },
})
