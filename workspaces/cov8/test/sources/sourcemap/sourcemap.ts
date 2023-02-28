/* eslint-disable */

// The constructor overload is TSDeclareMethod
class Foo {
  constructor(foo: string)
  constructor(public _foo: string) {}
}

// This module declaration is TSModuleDeclaration (isTypescript + isDeclaration)
declare module '@plugjs/plug' {
  // nothing to declare
}

export const p = process.env.PATH ? true : /* coverage ignore next */ false

export const n = parseInt('100')

// Here Promise is a TSTypeReference
export function f(): Promise<Foo> {
  return Promise.resolve(new Foo('bar'))
}

// Import/Export types
import type { AssertionError } from 'node:assert'
export interface Bar extends AssertionError {}

// Cover something! :-)
f().then(() => {})
