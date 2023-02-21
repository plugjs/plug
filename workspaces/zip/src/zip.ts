// Reference ourselves, so that the constructor's parameters are correct
/// <reference path="./index.ts" />

import { createWriteStream } from 'node:fs'

import { $p, $ylw, assert, Files } from '@plugjs/plug'
import { ZipFile } from 'yazl'

import type { Context, PipeParameters, Plug } from '@plugjs/plug/pipe'
import type EventEmitter from 'node:events'


// The "yazl" types don't define "ZipFile" as an "EventEmitter"
declare module 'yazl' {
  interface ZipFile extends EventEmitter {
    on(event: 'error', listener: (err: Error) => void): this;
  }
}

/** Writes some info about the current {@link Files} being passed around. */
export class Zip implements Plug<Files> {
  constructor(...args: PipeParameters<'zip'>)
  constructor(private readonly _filename: string) {
    assert(_filename, 'No filename specified for ZIP file')
  }

  pipe(files: Files, context: Context): Promise<Files> {
    const filename = context.resolve(this._filename)

    /* Create a new ZipFile piping to a WriteStream */
    const zipfile = new ZipFile()
    const zipstream = createWriteStream(filename)
    zipfile.outputStream.pipe(zipstream)

    /* Add all unique files to the zip */
    context.log.info(`Packaging ${$ylw(files.length)} files`)
    for (const [ relative, absolute ] of files.pathMappings()) {
      context.log.debug(`Adding file ${$p(absolute)}`)
      zipfile.addFile(absolute, relative)
    }

    /* All files are added, just compute our return */
    const output = Files.builder(context.buildDir).add(filename).build()
    zipfile.end()

    /* When done, resolve or reject! */
    return new Promise((resolve, reject) => {
      zipfile.on('error', (error) => reject(error))
      zipstream.on('error', (error) => reject(error))
      zipstream.on('close', () => resolve(output))
    })
  }
}
