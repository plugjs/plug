---
name: cov8
description: Collect and analyse Node.js V8 test coverage with @plugjs/cov8, configure coverage thresholds and reports, and integrate coverage into a Plug build file. Use for consuming cov8 in JavaScript or TypeScript projects.
---

# Use cov8

Use the project's existing test runner. cov8 collects or reads Node.js V8 coverage,
analyses the selected original source files, checks thresholds, and optionally
writes an HTML report. It does not supply a test framework.

Choose the CLI for a standalone command or package script. Use the Plug API when
the project already has a Plug build or needs separate per-file thresholds or
source-map bias settings. Preserve the user's source selection and thresholds;
do not lower thresholds or add ignores merely to make a build pass.

## Setup

Use Node.js 22.16.0 or newer. Install cov8 and its Plug peer dependency with the
project's package manager; for npm:

```sh
npm install --save-dev @plugjs/cov8 @plugjs/plug
```

Keep the packages compatible with cov8's declared peer dependency. Existing
projects should retain their package-manager and lockfile conventions.

## Command line

Put cov8 options before the command. Everything after the first positional
argument is the command and its arguments; `--` makes that boundary explicit.

Run Node's test runner, print uncovered lines, and generate a report:

```sh
npx cov8 --lines --report-dir coverage -- node --test
```

Replace `node --test` with the project's actual test command, such as `npm test`.
Without `--coverage-dir`, cov8 collects raw data in a temporary directory and
removes it afterward. Report files in `--report-dir` remain available.

Select TypeScript sources and require at least 80% coverage:

```sh
npx cov8 --source-dir src --sources '**/*.ts' --minimum 80 --optimal 95 --lines --report-dir coverage -- node --test
```

Quote globs so the shell does not expand them. Use one `--sources` option; repeated
occurrences are not reliably handled. Select application sources, not test files
or generated JavaScript when the intended report is for original TypeScript.

| Option                     | Meaning                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `-c`, `--coverage-dir DIR` | Read raw V8 coverage here; also collect into this directory when running a command.                                                 |
| `-r`, `--report-dir DIR`   | Write `index.html`, `report.js`, and `report.json`. Omit for console output only.                                                   |
| `-d`, `--source-dir DIR`   | Directory containing sources; defaults to `src`.                                                                                    |
| `-s`, `--sources GLOB`     | Source-selection glob, relative to the source directory.                                                                            |
| `-m`, `--minimum NUMBER`   | Overall minimum percentage; the CLI also uses this as the per-file minimum. Defaults to 50.                                         |
| `-o`, `--optimal NUMBER`   | Overall warning threshold; defaults to the rounded midpoint of the overall minimum and 100. Does not override the per-file optimum. |
| `-l`, `--lines`            | Print nonempty uncovered-line lists as consecutive ranges. Defaults to false; `--no-lines` disables it.                             |
| `-h`, `--help`             | Show usage.                                                                                                                         |
| `--version`                | Show the package version.                                                                                                           |

The default glob selects `.js`, `.cjs`, `.mjs`, `.ts`, `.cts`, and `.mts` files.
The CLI excludes `.d.ts`, `.d.cts`, and `.d.mts` files. JSX/TSX is not supported by
the current parser configuration. `LOG_LEVEL` controls logging, defaulting to
`notice`.

`--force-esm` and `--force-cjs` configure the bundled TypeScript loader's `.ts`
module format. These are not coverage settings and do not replace the test runner's
own configuration.

### Analyse existing coverage

With no command, `--coverage-dir` is required:

```sh
npx cov8 --coverage-dir .coverage-data --source-dir src --lines --report-dir coverage
```

The directory must contain Node.js `coverage-*.json` files, not an Istanbul/nyc JSON
report or LCOV file. For example, collect data separately in a POSIX shell:

```sh
NODE_V8_COVERAGE=.coverage-data node --test
```

Use a fresh directory for each independent run. cov8 combines all supplied coverage
files, including older files left in an explicitly selected directory. A dedicated
directory may be deliberately shared by several test commands whose coverage should
be combined.

### Exit status

Below-minimum overall or per-file coverage fails the command. Below-optimum coverage
warns without failing. A failing child command also fails cov8; analysis is not run
after that failure. Missing raw coverage files fail analysis. Empty source selections
can produce a warning instead of failure, so verify that the report lists the intended
files rather than treating exit status alone as proof of coverage.

## Plug build integration

Import `@plugjs/cov8` for its registration side effect before using `.coverage()`.
Pass the original source file set into the pipe; pass the raw coverage directory as
the first argument. The pipe analyses existing data—it does not execute tests.

Example `build.ts`, using Node's test runner:

```ts
import '@plugjs/cov8'
import { exec, find, plugjs, rmrf } from '@plugjs/plug'

const coverageDir = '.coverage-data'

export default plugjs({
  async test() {
    // This directory is dedicated to disposable raw coverage for this build.
    await rmrf(coverageDir)
    await exec(process.execPath, '--test', { coverageDir })
  },

  async coverage() {
    await this.test()

    return await find('**/*.([cm])?[jt]s', {
      directory: 'src',
      ignore: '**/*.d.([cm])?ts',
    }).coverage(coverageDir, {
      reportDir: 'coverage',
      minimumCoverage: 80,
      optimalCoverage: 95,
      minimumFileCoverage: 70,
      optimalFileCoverage: 90,
      reportUncoveredLines: true,
    })
  },
})
```

Run it from the consumer project's root:

```sh
npx plug coverage
```

Adapt the `test` task to the existing runner and task structure. Plug's `exec`
option `coverageDir` sets `NODE_V8_COVERAGE` for the child. When combining multiple
test commands, clear the dedicated directory once before the first command, not
between commands. Do not use cov8's own monorepo test commands in a consumer project.

### Explicit plug construction

An alternative to registering the pipe method is importing the class directly:

```ts
import { find } from '@plugjs/plug'
import { Coverage } from '@plugjs/cov8/coverage'

// Inside a Plug task, after tests have populated .coverage-data:
await find('**/*.ts', { directory: 'src', ignore: '**/*.d.ts' })
    .plug(new Coverage('.coverage-data', {
      reportDir: 'coverage',
      reportUncoveredLines: true,
    }))
```

Do not use private `src/` or `dist/` import paths. The supported entry points are
`@plugjs/cov8` and `@plugjs/cov8/coverage`.

### API options and return values

| Option                 | Default / behavior |
| ---------------------- | -------------------------------------------------------------------------- |
| `minimumCoverage`      | Overall minimum, 50%.                                                      |
| `minimumFileCoverage`  | Per-file minimum; inherits `minimumCoverage`.                              |
| `optimalCoverage`      | `Math.round((100 + minimumCoverage) / 2)`, normally 75%.                   |
| `optimalFileCoverage`  | `Math.round((100 + minimumFileCoverage) / 2)`, normally 75%.               |
| `reportUncoveredLines` | `false`. Enables uncovered-line ranges in console reporting.               |
| `sourceMapBias`        | `'least_upper_bound'`; also accepts `'greatest_lower_bound'` and `'none'`. |
| `reportDir`            | Omitted by default. Enables report files when supplied.                    |

Without `reportDir`, awaiting `.coverage()` yields `undefined`. With `reportDir`,
the method returns a `Pipe` containing the generated report files, which can be
chained or awaited. `CoverageOptions` and `CoverageReportOptions` are exported types.

Use the API for separate per-file thresholds and `sourceMapBias`: the CLI has no
flags for those options. Keep the default source-map bias unless there is a concrete
mapping issue to investigate. `'none'` requires exact mappings and sums counts from
all generated locations mapped to the same original position.

## Interpret and inspect reports

cov8 percentages measure AST nodes, not lines, statements, or branches in the
Istanbul sense. The percentage is rounded down. Skipped syntax is excluded; explicitly
ignored nodes are excluded from the denominator. Empty or entirely skipped/ignored
files report `n/a`, represented as `null` in JSON.

- Open `coverage/index.html`; keep its companion `report.js` alongside it.
- Use `report.json` for automation. It contains `results` keyed by absolute source
  path, aggregate `nodes`, `thresholds`, and a generation `date`.
- Each file result contains `code`, `codeCoverage`, `nodeCoverage`, and
  `uncoveredLines`. Line numbers are unique, one-based, and ascending; a partially
  uncovered line is included.
- Character coverage uses UTF-16 offsets: `-2` means skipped, `-1` ignored, `0`
  uncovered, and positive values are execution counts assigned from AST nodes.

For transpiled TypeScript, collect coverage from the executed JavaScript while
selecting the original TypeScript sources. Preserve source maps and source files
until analysis finishes; a TypeScript compiler can emit maps with `sourceMap: true`
or `inlineSourceMap: true`. Missing maps can prevent original-source matching even
though direct JavaScript coverage is available.

## Intentional exclusions

Use ignores only for code deliberately excluded from coverage requirements. Both
`coverage ignore` and `istanbul ignore` spellings are recognized.

```ts
/* coverage ignore next */
function platformFallback() {
  throw new Error('Unavailable on this platform')
}
```

`next` applies to the following node/subtree; `prev` is a trailing comment on the
preceding node. Put `file` before the first statement or directive, including before
`"use strict"`. Leading comments on an `if` support `test`, `if`, and `else`; leading
comments on a `try` support `try`, `catch`, and `finally` to ignore the corresponding
part. For example:

```ts
/* coverage ignore else */
if (supported) {
  run()
} else {
  platformFallback()
}
```

Prefer declaration-level `import type` and `export type`: specifier-level forms such
as `import { type Foo }` are not fully excluded by this analyser. Use LF or CRLF line
endings; other JavaScript line terminators are not reliably handled. Do not silently
rewrite these constructs or add ignores when reporting a coverage discrepancy.
