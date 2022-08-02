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
  } ?
    ConstructorArgument<A0> |
    ConstructorArgument<A1> |
    ConstructorArgument<A2> |
    ConstructorArgument<A3> |
    ConstructorArgument<A4> |
    ConstructorArgument<A5> |
    ConstructorArgument<A6> |
    ConstructorArgument<A7> |
    ConstructorArgument<A8> :
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
  } ?
    ConstructorArgument<A0> |
    ConstructorArgument<A1> |
    ConstructorArgument<A2> |
    ConstructorArgument<A3> |
    ConstructorArgument<A4> |
    ConstructorArgument<A5> |
    ConstructorArgument<A6> |
    ConstructorArgument<A7> |
    ConstructorArgument<A8> :
  T extends {
    new (...args: infer A0): any
    new (...args: infer A1): any
    new (...args: infer A2): any
    new (...args: infer A3): any
    new (...args: infer A4): any
    new (...args: infer A5): any
    new (...args: infer A6): any
    new (...args: infer A7): any
  } ?
    ConstructorArgument<A0> |
    ConstructorArgument<A1> |
    ConstructorArgument<A2> |
    ConstructorArgument<A3> |
    ConstructorArgument<A4> |
    ConstructorArgument<A5> |
    ConstructorArgument<A6> |
    ConstructorArgument<A7> :
  T extends {
    new (...args: infer A0): any
    new (...args: infer A1): any
    new (...args: infer A2): any
    new (...args: infer A3): any
    new (...args: infer A4): any
    new (...args: infer A5): any
    new (...args: infer A6): any
  } ?
    ConstructorArgument<A0> |
    ConstructorArgument<A1> |
    ConstructorArgument<A2> |
    ConstructorArgument<A3> |
    ConstructorArgument<A4> |
    ConstructorArgument<A5> |
    ConstructorArgument<A6> :
  T extends {
    new (...args: infer A0): any
    new (...args: infer A1): any
    new (...args: infer A2): any
    new (...args: infer A3): any
    new (...args: infer A4): any
    new (...args: infer A5): any
  } ?
    ConstructorArgument<A0> |
    ConstructorArgument<A1> |
    ConstructorArgument<A2> |
    ConstructorArgument<A3> |
    ConstructorArgument<A4> |
    ConstructorArgument<A5> :
  T extends {
    new (...args: infer A0): any
    new (...args: infer A1): any
    new (...args: infer A2): any
    new (...args: infer A3): any
    new (...args: infer A4): any
  } ?
    ConstructorArgument<A0> |
    ConstructorArgument<A1> |
    ConstructorArgument<A2> |
    ConstructorArgument<A3> |
    ConstructorArgument<A4> :
  T extends {
    new (...args: infer A0): any
    new (...args: infer A1): any
    new (...args: infer A2): any
    new (...args: infer A3): any
  } ?
    ConstructorArgument<A0> |
    ConstructorArgument<A1> |
    ConstructorArgument<A2> |
    ConstructorArgument<A3> :
  T extends {
    new (...args: infer A0): any
    new (...args: infer A1): any
    new (...args: infer A2): any
  } ?
    ConstructorArgument<A0> |
    ConstructorArgument<A1> |
    ConstructorArgument<A2> :
  T extends {
    new (...args: infer A0): any
    new (...args: infer A1): any
  } ?
    ConstructorArgument<A0> |
    ConstructorArgument<A1> :
  T extends {
    new (...args: infer A): any
  } ? ConstructorArgument<A> :
  never
