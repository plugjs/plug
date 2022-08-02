/* eslint-disable @typescript-eslint/no-unused-vars */

/* ========================================================================== *
 * TYPES OVERRIDES / EXTENSIONS                                               *
 * ========================================================================== */

/*
 * Type definition for `WebAssembly`. This is normally provided to TypeScript
 * by `lib.dom.d.ts`, and is not defined by Node's own types.
 *
 * https://github.com/evanw/esbuild/issues/2388
 */
declare namespace WebAssembly {
  interface Module {} // for esbuild types
}

/**
 * When converting constructor parameters, we only want to keep known tuples
 * in our arguments list, otherwise we'll end up with an extra `unknown[]`.
 */
export type ConstructorArgument<T extends readonly any[]> =
  T extends [ infer First, ...infer Rest ] ?
    [ First, ...ConstructorArgument<Rest> ] :
  T extends [ infer Only ] ?
    [ Only ] :
  T extends [] ?
    [] :
  never

/**
 * When converting constructor parameters to function parameters (e.g. when
 * installing a `Plug` into a `Pipe`) we need to convert _all_ overloads.
 */
export type ConstructorArguments<T> =
  /* Converts the case where the constructor has up to 9 overloads */
  T extends {
    new (...args: infer A0): any
    new (...args: infer A1): any
    new (...args: infer A2): any
    new (...args: infer A3): any
    new (...args: infer A4): any
    new (...args: infer A5): any
    new (...args: infer A6): any
    new (...args: infer A7): any
    new (...args: infer A8): any
    new (...args: infer A9): any
  } ?
    ConstructorArgument<A0> |
    ConstructorArgument<A1> |
    ConstructorArgument<A2> |
    ConstructorArgument<A3> |
    ConstructorArgument<A4> |
    ConstructorArgument<A5> |
    ConstructorArgument<A6> |
    ConstructorArgument<A7> |
    ConstructorArgument<A8> |
    ConstructorArgument<A9> :
  /* Converts the case where the constructor has no overloads */
  T extends {
    new (...args: infer A): any
  } ?
    ConstructorArgument<A> :
  /* Ain't a constructor, dude! */
  never
