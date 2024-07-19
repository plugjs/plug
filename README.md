PlugJS Build System
===================

JavaScript/TypeScript build system from [Juit GmbH](https://www.juit.com/)

PlugJS is a framework for creating build systems. It is heavily reliant on
TypeScript and ESBuild, includes support for testing, coverage, and linting.

See the [PlugJS Stock Build](https://www.npmjs.com/package/@plugjs/build) for
a pre-configured project template working with TypeScript sources and producing
dual-format (ESM and CommonJS) redistributable libraries.

Packages
--------

* [`@plugjs/plug`](./workspaces/plug/README.md): Our main package
* [`@plugjs/cov8`](./workspaces/cov8/README.md): V8 Coverage Support
* [`@plugjs/eslint`](./workspaces/eslint/README.md): ESLint Support
* [`@plugjs/expect5`](./workspaces/expect5/README.md): Unit Testing Support
* [`@plugjs/tsd`](./workspaces/tsd/README.md): TSD (TypeScript types testing) Support
* [`@plugjs/typescript`](./workspaces/typescript/README.md): TypeScript Support
* [`@plugjs/zip`](./workspaces/zip/README.md): Zip Files Support

Legal
-----

* [Copyright Notice](NOTICE.md)
* [License](LICENSE.md)
