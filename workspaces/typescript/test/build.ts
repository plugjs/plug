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
  async ['simple typescript test']() {
    await find('**/*.ts', { directory: '@/data' })
        .plug(new Tsc())
        .then((r) => assert(r.length === 0, 'Files produced???'))
  },

  async ['bad_config typescript test']() {
    await find('**/*.ts', { directory: '@/data' })
        .plug(new Tsc('@/data/bad.tsconfig.json'))
        .then(() => assert(false, 'This should fail'), () => void 0)
  },

  async ['types typescript test']() {
    await find('**/*.ts', { directory: '@/extra/src' })
        .plug(new Tsc())
        .then(() => assert(false, 'This should fail'), () => void 0)

    await find('**/*.ts', { directory: '@/extra/src' })
        .plug(new Tsc({ extraTypesDir: '@/extra/types' }))
        .then((r) => assert(r.length === 0, 'Files produced???'))
  },

  async ['no_file typescript test']() {
    const files = Files.builder(resolve('@/data')).add('missing.ts').build()
    const pipe = merge([ files ])

    await pipe.plug(new Tsc())
        .then(() => assert(false, 'This should fail'), () => void 0)
  },

  async ['base typescript test']() {
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

  async ['outfile typescript test']() {
    const dir = await mkdtemp(join(tmpdir(), 'plug-'))
    const file = join(dir, 'output.js')
    try {
      await find('**/*.ts', { directory: '@/data' })
          .plug(new Tsc('@/tsconfig-empty.json', {
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

  async ['rootdir typescript test']() {
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

  async ['rootdirs typescript test']() {
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

  async ['baseurl typescript test']() {
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
      await rmrf(dir)
    }
  },

  async ['install typescript test']() {
    const pipe1 = merge([])
    assert(typeof pipe1.tsc === 'undefined', 'Typescript already installed')
    await import('../src/index')
    const pipe2 = merge([])
    assert(typeof pipe2.tsc === 'function', 'Typescript not installed')
  },

  async ['options typescript test']() {
    await find('options.test.ts', { directory: '@' }).jasmine()
  },

  async ['typescript test'](): Promise<void> {
    await this['outfile typescript test']()

    await this['simple typescript test']()
    await this['bad_config typescript test']()
    await this['types typescript test']()
    await this['no_file typescript test']()
    await this['base typescript test']()
    await this['rootdir typescript test']()
    await this['rootdirs typescript test']()
    await this['baseurl typescript test']()

    await this['options typescript test']()

    await this['install typescript test']()
  },
})
