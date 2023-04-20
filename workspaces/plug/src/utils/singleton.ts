/**
 * Get the instance of a _singleton_ variable.
 *
 * Sometimes we need unique instances _per process_ (for example our async
 * context). The problem is that the code might get called from two (or three)
 * different versions of this file: the .cjs transpiled code, the .mjs
 * transpiled one, or the .ts dynamically transpiled by our dynamic loader.
 *
 * A _singleton_ associates an instance with a symbol in `globalThis` and ensure
 * there is only _one_ instance per process (per `globalThis`).
 */
export function getSingleton<T>(symbol: symbol, factory: () => T): T {
  const anyGlobalThis = globalThis as any
  if (anyGlobalThis[symbol]) return anyGlobalThis[symbol] as T

  const value = factory()
  Object.defineProperty(anyGlobalThis, symbol, { value })
  return value
}
