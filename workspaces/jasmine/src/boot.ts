// Keep the "boot" part in a separate file, as we'll mangle types to adapt
// "@types/jasmine" into something usable with "jasmine-core"
/// <reference types="jasmine" />

// @ts-ignore
import core from 'jasmine-core'

export function boot(): typeof jasmine {
  return core.boot(core)
}
