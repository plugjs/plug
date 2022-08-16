Testing PlugJS
==============

Remember that, for the time being, we can test this _only_ with our just-in-time
transpilation of `.ts` files.

Changing the `build.ts` file main `import` statement from `./src/index.ts` to
`./dist/index.mjs` (or self-referencing to `@plugjs/plugjs`) would create two
different copies of everything in memory: one is the pre-transpiled version, and
one is the just-in-time transpiled one.

With this split, doing simple things like calling `currentRun()` (which we use
in our log tests, for example) would return `undefined`, as the just-in-time
version of `currentRun()` (from the tests) know nothing about the pre-transpiled
one (from Mocha running the tests).
